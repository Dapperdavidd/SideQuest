//! Friends, friend groups ("rooms") and room votes for Friends challenges.
//!
//! Friendships are mutual: a request and an accept. Groups hold 2 to 50 members and their
//! challenges. Votes follow the v5 rules: one vote per member, never for your own entry,
//! a 24 hour window after the deadline, hidden until close, ties share the win, and at least
//! two entries and two votes or the challenge ends with no contest.

use actix_web::{
    HttpRequest, HttpResponse, ResponseError, delete, get, http::StatusCode, post, web,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Postgres, Transaction};
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

/// Hours after the deadline during which room members can vote.
pub const VOTE_WINDOW_HOURS: i64 = 24;
pub const MIN_ENTRIES_FOR_CONTEST: usize = 2;
pub const MIN_VOTES_FOR_CONTEST: usize = 2;

#[derive(Debug, Error)]
pub enum FriendsError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("that person or group was not found")]
    NotFound,
    #[error("you cannot add yourself")]
    SelfRequest,
    #[error("you are already friends")]
    AlreadyFriends,
    #[error("the group details are invalid")]
    InvalidGroup,
    #[error("this group is full")]
    GroupFull,
    #[error("only the group owner can do that")]
    NotOwner,
    #[error("voting is not open for this challenge")]
    VotingClosed,
    #[error("you cannot vote for your own entry")]
    SelfVote,
    #[error("you have already voted")]
    AlreadyVoted,
    #[error("only people in this challenge can vote")]
    NotInRoom,
    #[error("friends service is temporarily unavailable")]
    Database,
}

impl ResponseError for FriendsError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::NotOwner | Self::NotInRoom => StatusCode::FORBIDDEN,
            Self::SelfRequest | Self::InvalidGroup | Self::SelfVote => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            Self::AlreadyFriends | Self::GroupFull | Self::VotingClosed | Self::AlreadyVoted => {
                StatusCode::CONFLICT
            }
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::NotFound => "not_found",
                Self::SelfRequest => "self_friend_request",
                Self::AlreadyFriends => "already_friends",
                Self::InvalidGroup => "invalid_group",
                Self::GroupFull => "group_full",
                Self::NotOwner => "not_group_owner",
                Self::VotingClosed => "voting_closed",
                Self::SelfVote => "self_vote",
                Self::AlreadyVoted => "already_voted",
                Self::NotInRoom => "not_in_room",
                Self::Database => "friends_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

fn db(_: sqlx::Error) -> FriendsError {
    FriendsError::Database
}

#[derive(Debug, Serialize, FromRow)]
pub struct FriendPerson {
    id: Uuid,
    username: String,
    display_name: String,
    avatar_url: Option<String>,
    /// ACCEPTED, INCOMING (they asked you) or OUTGOING (you asked them).
    state: String,
    since: DateTime<Utc>,
}

#[get("/friends")]
pub async fn list_friends(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Vec<FriendPerson>>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let people = sqlx::query_as::<_, FriendPerson>(
        r#"
        select u.id, u.username, u.display_name, u.avatar_url,
               case when f.status = 'ACCEPTED' then 'ACCEPTED'
                    when f.addressee_id = $1 then 'INCOMING'
                    else 'OUTGOING' end as state,
               coalesce(f.accepted_at, f.created_at) as since
        from public.friendships f
        join public.users u
          on u.id = case when f.requester_id = $1 then f.addressee_id else f.requester_id end
        where (f.requester_id = $1 or f.addressee_id = $1)
          and u.account_status = 'ACTIVE'
        order by (f.status = 'ACCEPTED'), coalesce(f.accepted_at, f.created_at) desc
        "#,
    )
    .bind(user.id)
    .fetch_all(&state.database)
    .await
    .map_err(db)?;
    Ok(web::Json(people))
}

#[derive(Debug, Deserialize)]
pub struct FriendRequest {
    username: String,
}

#[derive(Debug, Serialize)]
pub struct FriendshipState {
    user_id: Uuid,
    state: &'static str,
}

/// Sends a friend request by username. If they already asked you, this accepts it.
#[post("/friends/requests")]
pub async fn request_friend(
    request: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<FriendRequest>,
) -> Result<web::Json<FriendshipState>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let username = body
        .username
        .trim()
        .trim_start_matches('@')
        .to_ascii_lowercase();
    let target = sqlx::query_scalar::<_, Uuid>(
        "select id from public.users where lower(username) = $1 and account_status = 'ACTIVE'",
    )
    .bind(&username)
    .fetch_optional(&state.database)
    .await
    .map_err(db)?
    .ok_or(FriendsError::NotFound)?;
    if target == user.id {
        return Err(FriendsError::SelfRequest);
    }
    let blocked = sqlx::query_scalar::<_, bool>(
        r#"select exists(select 1 from public.user_blocks
           where (blocker_id = $1 and blocked_id = $2) or (blocker_id = $2 and blocked_id = $1))"#,
    )
    .bind(user.id)
    .bind(target)
    .fetch_one(&state.database)
    .await
    .map_err(db)?;
    if blocked {
        return Err(FriendsError::NotFound);
    }

    let mut transaction = state.database.begin().await.map_err(db)?;
    let existing = sqlx::query_as::<_, (Uuid, String)>(
        r#"select requester_id, status from public.friendships
           where least(requester_id, addressee_id) = least($1, $2)
             and greatest(requester_id, addressee_id) = greatest($1, $2)
           for update"#,
    )
    .bind(user.id)
    .bind(target)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(db)?;

    let result = match existing {
        Some((_, status)) if status == "ACCEPTED" => return Err(FriendsError::AlreadyFriends),
        Some((requester, _)) if requester == target => {
            accept_in(&mut transaction, target, user.id).await?;
            "ACCEPTED"
        }
        Some(_) => "OUTGOING",
        None => {
            sqlx::query(
                "insert into public.friendships (requester_id, addressee_id) values ($1, $2)",
            )
            .bind(user.id)
            .bind(target)
            .execute(&mut *transaction)
            .await
            .map_err(db)?;
            notify(
                &mut transaction,
                target,
                Some(user.id),
                None,
                "FRIEND_REQUEST",
                "New friend request",
                "Someone wants to add you on SideQuest.",
                "/friends",
            )
            .await?;
            "OUTGOING"
        }
    };
    transaction.commit().await.map_err(db)?;
    Ok(web::Json(FriendshipState {
        user_id: target,
        state: result,
    }))
}

#[post("/friends/requests/{user_id}/accept")]
pub async fn accept_friend(
    request: HttpRequest,
    state: web::Data<AppState>,
    requester: web::Path<Uuid>,
) -> Result<web::Json<FriendshipState>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let requester = requester.into_inner();
    let mut transaction = state.database.begin().await.map_err(db)?;
    accept_in(&mut transaction, requester, user.id).await?;
    transaction.commit().await.map_err(db)?;
    Ok(web::Json(FriendshipState {
        user_id: requester,
        state: "ACCEPTED",
    }))
}

async fn accept_in(
    transaction: &mut Transaction<'_, Postgres>,
    requester: Uuid,
    addressee: Uuid,
) -> Result<(), FriendsError> {
    let updated = sqlx::query(
        r#"update public.friendships set status = 'ACCEPTED', accepted_at = now()
           where requester_id = $1 and addressee_id = $2 and status = 'REQUESTED'"#,
    )
    .bind(requester)
    .bind(addressee)
    .execute(&mut **transaction)
    .await
    .map_err(db)?;
    if updated.rows_affected() == 0 {
        return Err(FriendsError::NotFound);
    }
    notify(
        transaction,
        requester,
        Some(addressee),
        None,
        "FRIEND_ACCEPTED",
        "You're friends now",
        "Your friend request was accepted. Send them a challenge.",
        "/friends",
    )
    .await
}

/// Removes a friend, declines an incoming request or cancels an outgoing one.
#[delete("/friends/{user_id}")]
pub async fn remove_friend(
    request: HttpRequest,
    state: web::Data<AppState>,
    other: web::Path<Uuid>,
) -> Result<HttpResponse, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    sqlx::query(
        r#"delete from public.friendships
           where (requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)"#,
    )
    .bind(user.id)
    .bind(other.into_inner())
    .execute(&state.database)
    .await
    .map_err(db)?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Serialize, FromRow)]
pub struct FriendGroup {
    id: Uuid,
    owner_id: Uuid,
    name: String,
    avatar_url: Option<String>,
    invite_code: String,
    member_count: i64,
    active_challenges: i64,
    viewer_role: String,
    created_at: DateTime<Utc>,
}

const GROUP_SELECT: &str = r#"
    select g.id, g.owner_id, g.name, g.avatar_url, g.invite_code,
           (select count(*) from public.friend_group_members m where m.group_id = g.id) as member_count,
           (select count(*) from public.quests q where q.group_id = g.id and q.status in ('OPEN', 'CLOSED_FOR_REVIEW')) as active_challenges,
           me.role as viewer_role,
           g.created_at
    from public.friend_groups g
    join public.friend_group_members me on me.group_id = g.id and me.user_id = $1
"#;

#[get("/friends/groups")]
pub async fn list_groups(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Vec<FriendGroup>>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let groups =
        sqlx::query_as::<_, FriendGroup>(&format!("{GROUP_SELECT} order by me.joined_at desc"))
            .bind(user.id)
            .fetch_all(&state.database)
            .await
            .map_err(db)?;
    Ok(web::Json(groups))
}

#[derive(Debug, Deserialize)]
pub struct CreateGroup {
    name: String,
    #[serde(default)]
    member_ids: Vec<Uuid>,
}

impl CreateGroup {
    fn validate(&self) -> Result<(), FriendsError> {
        if !(2..=40).contains(&self.name.trim().chars().count()) || self.member_ids.len() > 49 {
            return Err(FriendsError::InvalidGroup);
        }
        Ok(())
    }
}

/// Creates a group with you as owner. Initial members must already be your friends.
#[post("/friends/groups")]
pub async fn create_group(
    request: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateGroup>,
) -> Result<(web::Json<FriendGroup>, StatusCode), FriendsError> {
    body.validate()?;
    let user = state.auth.authenticate(&request).await?;
    let mut transaction = state.database.begin().await.map_err(db)?;
    let group_id = sqlx::query_scalar::<_, Uuid>(
        "insert into public.friend_groups (owner_id, name) values ($1, $2) returning id",
    )
    .bind(user.id)
    .bind(body.name.trim())
    .fetch_one(&mut *transaction)
    .await
    .map_err(db)?;
    sqlx::query(
        "insert into public.friend_group_members (group_id, user_id, role) values ($1, $2, 'OWNER')",
    )
    .bind(group_id)
    .bind(user.id)
    .execute(&mut *transaction)
    .await
    .map_err(db)?;
    sqlx::query(
        r#"
        insert into public.friend_group_members (group_id, user_id)
        select $1, friend.id
        from unnest($3::uuid[]) as friend(id)
        join public.users u on u.id = friend.id and u.group_invite_permission = 'FRIENDS'
        where exists(
          select 1 from public.friendships f
          where f.status = 'ACCEPTED'
            and least(f.requester_id, f.addressee_id) = least($2, friend.id)
            and greatest(f.requester_id, f.addressee_id) = greatest($2, friend.id)
        )
        on conflict do nothing
        "#,
    )
    .bind(group_id)
    .bind(user.id)
    .bind(&body.member_ids)
    .execute(&mut *transaction)
    .await
    .map_err(db)?;
    let group = sqlx::query_as::<_, FriendGroup>(&format!("{GROUP_SELECT} where g.id = $2"))
        .bind(user.id)
        .bind(group_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(db)?;
    transaction.commit().await.map_err(db)?;
    Ok((web::Json(group), StatusCode::CREATED))
}

#[derive(Debug, Serialize, FromRow)]
pub struct GroupMember {
    id: Uuid,
    username: String,
    display_name: String,
    avatar_url: Option<String>,
    role: String,
    season_wins: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct GroupChallenge {
    id: Uuid,
    title: String,
    status: String,
    deadline: DateTime<Utc>,
    votes_close_at: DateTime<Utc>,
    winner_selection_method: String,
    friendly_stake: Option<String>,
    cover_media_url: Option<String>,
    creator_display_name: String,
    entries_received: i64,
    viewer_entered: bool,
    viewer_voted: bool,
}

#[derive(Debug, Serialize)]
pub struct GroupRoom {
    group: FriendGroup,
    members: Vec<GroupMember>,
    challenges: Vec<GroupChallenge>,
}

#[get("/friends/groups/{group_id}")]
pub async fn get_group(
    request: HttpRequest,
    state: web::Data<AppState>,
    group_id: web::Path<Uuid>,
) -> Result<web::Json<GroupRoom>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let group_id = group_id.into_inner();
    let group = sqlx::query_as::<_, FriendGroup>(&format!("{GROUP_SELECT} where g.id = $2"))
        .bind(user.id)
        .bind(group_id)
        .fetch_optional(&state.database)
        .await
        .map_err(db)?
        .ok_or(FriendsError::NotFound)?;
    let members = sqlx::query_as::<_, GroupMember>(
        r#"
        select u.id, u.username, u.display_name, u.avatar_url, m.role,
               (select count(*) from public.quest_winners w
                join public.quest_entries e on e.id = w.entry_id
                join public.quests q on q.id = w.quest_id
                where q.group_id = $1 and e.participant_id = u.id
                  and w.finalized_at >= date_trunc('month', now())) as season_wins
        from public.friend_group_members m
        join public.users u on u.id = m.user_id
        where m.group_id = $1
        order by season_wins desc, m.joined_at
        "#,
    )
    .bind(group_id)
    .fetch_all(&state.database)
    .await
    .map_err(db)?;
    let challenges = sqlx::query_as::<_, GroupChallenge>(&format!(
        "{CHALLENGE_SELECT} where q.group_id = $2 order by q.deadline desc limit 30"
    ))
    .bind(user.id)
    .bind(group_id)
    .fetch_all(&state.database)
    .await
    .map_err(db)?;
    Ok(web::Json(GroupRoom {
        group,
        members,
        challenges,
    }))
}

const CHALLENGE_SELECT: &str = r#"
    select q.id, q.title, q.status::text as status, q.deadline,
           coalesce(q.votes_close_at, q.deadline + interval '24 hours') as votes_close_at,
           q.winner_selection_method::text as winner_selection_method,
           q.friendly_stake, q.cover_media_url,
           creator.display_name as creator_display_name,
           (select count(*) from public.quest_entries e where e.quest_id = q.id) as entries_received,
           exists(select 1 from public.quest_entries e where e.quest_id = q.id and e.participant_id = $1) as viewer_entered,
           exists(select 1 from public.challenge_votes v where v.quest_id = q.id and v.voter_id = $1) as viewer_voted
    from public.quests q
    join public.users creator on creator.id = q.creator_id
"#;

/// Friends challenges that reached you: sent to you directly, to a group you're in, or yours.
#[get("/friends/challenges")]
pub async fn list_challenges(
    request: HttpRequest,
    state: web::Data<AppState>,
) -> Result<web::Json<Vec<GroupChallenge>>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let challenges = sqlx::query_as::<_, GroupChallenge>(&format!(
        r#"{CHALLENGE_SELECT}
        where q.quest_type = 'FRIENDS'
          and q.status not in ('DRAFT', 'CANCELLED', 'SUSPENDED')
          and (
            q.creator_id = $1
            or exists(select 1 from public.quest_audience a where a.quest_id = q.id and a.user_id = $1)
            or exists(select 1 from public.friend_group_members m where m.group_id = q.group_id and m.user_id = $1)
            or exists(select 1 from public.quest_participants p where p.quest_id = q.id and p.user_id = $1)
          )
        order by (q.status = 'OPEN') desc, q.deadline asc
        limit 50"#
    ))
    .bind(user.id)
    .fetch_all(&state.database)
    .await
    .map_err(db)?;
    Ok(web::Json(challenges))
}

#[derive(Debug, Serialize, FromRow)]
pub struct GroupInvitePreview {
    id: Uuid,
    name: String,
    owner_display_name: String,
    member_count: i64,
    viewer_is_member: bool,
}

#[get("/g/{code}")]
pub async fn preview_group_invite(
    request: HttpRequest,
    state: web::Data<AppState>,
    code: web::Path<String>,
) -> Result<web::Json<GroupInvitePreview>, FriendsError> {
    let viewer = state.auth.authenticate_optional(&request).await?;
    let preview = sqlx::query_as::<_, GroupInvitePreview>(
        r#"
        select g.id, g.name, owner.display_name as owner_display_name,
               (select count(*) from public.friend_group_members m where m.group_id = g.id) as member_count,
               ($2::uuid is not null and exists(
                 select 1 from public.friend_group_members m where m.group_id = g.id and m.user_id = $2
               )) as viewer_is_member
        from public.friend_groups g
        join public.users owner on owner.id = g.owner_id
        where g.invite_code = upper($1)
        "#,
    )
    .bind(code.into_inner())
    .bind(viewer.map(|user| user.id))
    .fetch_optional(&state.database)
    .await
    .map_err(db)?
    .ok_or(FriendsError::NotFound)?;
    Ok(web::Json(preview))
}

#[post("/g/{code}/join")]
pub async fn join_group(
    request: HttpRequest,
    state: web::Data<AppState>,
    code: web::Path<String>,
) -> Result<web::Json<GroupInvitePreview>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let code = code.into_inner();
    let mut transaction = state.database.begin().await.map_err(db)?;
    let (group_id, owner_id) = sqlx::query_as::<_, (Uuid, Uuid)>(
        "select id, owner_id from public.friend_groups where invite_code = upper($1) for update",
    )
    .bind(&code)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(db)?
    .ok_or(FriendsError::NotFound)?;
    let inserted = sqlx::query(
        "insert into public.friend_group_members (group_id, user_id) values ($1, $2) on conflict do nothing",
    )
    .bind(group_id)
    .bind(user.id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| match error {
        sqlx::Error::Database(database) if database.code().as_deref() == Some("23514") => {
            FriendsError::GroupFull
        }
        _ => FriendsError::Database,
    })?;
    if inserted.rows_affected() > 0 && owner_id != user.id {
        notify(
            &mut transaction,
            owner_id,
            Some(user.id),
            None,
            "GROUP_JOINED",
            "Someone joined your group",
            "A new member joined through your invite link.",
            &format!("/friends/groups/{group_id}"),
        )
        .await?;
    }
    let preview = sqlx::query_as::<_, GroupInvitePreview>(
        r#"
        select g.id, g.name, owner.display_name as owner_display_name,
               (select count(*) from public.friend_group_members m where m.group_id = g.id) as member_count,
               true as viewer_is_member
        from public.friend_groups g join public.users owner on owner.id = g.owner_id
        where g.id = $1
        "#,
    )
    .bind(group_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(db)?;
    transaction.commit().await.map_err(db)?;
    Ok(web::Json(preview))
}

/// Leave a group. The owner cannot leave while other members remain.
#[delete("/friends/groups/{group_id}/members/me")]
pub async fn leave_group(
    request: HttpRequest,
    state: web::Data<AppState>,
    group_id: web::Path<Uuid>,
) -> Result<HttpResponse, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let group_id = group_id.into_inner();
    let (owner_id, members) = sqlx::query_as::<_, (Uuid, i64)>(
        "select owner_id, (select count(*) from public.friend_group_members where group_id = $1) from public.friend_groups where id = $1",
    )
    .bind(group_id)
    .fetch_optional(&state.database)
    .await
    .map_err(db)?
    .ok_or(FriendsError::NotFound)?;
    if owner_id == user.id && members > 1 {
        return Err(FriendsError::NotOwner);
    }
    if owner_id == user.id {
        sqlx::query("delete from public.friend_groups where id = $1")
            .bind(group_id)
            .execute(&state.database)
            .await
            .map_err(db)?;
    } else {
        sqlx::query("delete from public.friend_group_members where group_id = $1 and user_id = $2")
            .bind(group_id)
            .bind(user.id)
            .execute(&state.database)
            .await
            .map_err(db)?;
    }
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Serialize, FromRow)]
pub struct VoteCandidate {
    entry_id: Uuid,
    participant_id: Uuid,
    participant_display_name: String,
    participant_avatar_url: Option<String>,
    caption: Option<String>,
    media_url: Option<String>,
    submitted_at: DateTime<Utc>,
    /// Only filled in after voting closes.
    votes: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct VoteBallot {
    quest_id: Uuid,
    title: String,
    group_name: Option<String>,
    deadline: DateTime<Utc>,
    votes_close_at: DateTime<Utc>,
    phase: &'static str,
    winner_count: i16,
    viewer_vote: Option<Uuid>,
    viewer_can_vote: bool,
    candidates: Vec<VoteCandidate>,
}

/// Whether the viewer belongs to this challenge's room: creator, group member, audience or entrant.
async fn in_room(state: &AppState, quest_id: Uuid, user_id: Uuid) -> Result<bool, FriendsError> {
    sqlx::query_scalar::<_, bool>(
        r#"
        select exists(
          select 1 from public.quests q
          where q.id = $1 and q.quest_type = 'FRIENDS' and (
            q.creator_id = $2
            or exists(select 1 from public.friend_group_members m where m.group_id = q.group_id and m.user_id = $2)
            or exists(select 1 from public.quest_audience a where a.quest_id = q.id and a.user_id = $2)
            or exists(select 1 from public.quest_participants p where p.quest_id = q.id and p.user_id = $2)
          )
        )
        "#,
    )
    .bind(quest_id)
    .bind(user_id)
    .fetch_one(&state.database)
    .await
    .map_err(db)
}

pub fn vote_phase(
    now: DateTime<Utc>,
    deadline: DateTime<Utc>,
    closes: DateTime<Utc>,
) -> &'static str {
    if now < deadline {
        "SUBMITTING"
    } else if now < closes {
        "VOTING"
    } else {
        "CLOSED"
    }
}

#[get("/quests/{quest_id}/vote")]
pub async fn get_ballot(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<VoteBallot>, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    if !in_room(&state, quest_id, user.id).await? {
        return Err(FriendsError::NotFound);
    }
    let (title, group_name, deadline, closes, winner_count, method) = sqlx::query_as::<
        _,
        (
            String,
            Option<String>,
            DateTime<Utc>,
            DateTime<Utc>,
            i16,
            String,
        ),
    >(
        r#"
            select q.title, g.name, q.deadline,
                   coalesce(q.votes_close_at, q.deadline + interval '24 hours'),
                   q.winner_count, q.winner_selection_method::text
            from public.quests q left join public.friend_groups g on g.id = q.group_id
            where q.id = $1
            "#,
    )
    .bind(quest_id)
    .fetch_one(&state.database)
    .await
    .map_err(db)?;
    if method != "ROOM_VOTE" {
        return Err(FriendsError::NotFound);
    }
    let phase = vote_phase(Utc::now(), deadline, closes);
    let candidates = sqlx::query_as::<_, VoteCandidate>(
        r#"
        select e.id as entry_id, e.participant_id,
               u.display_name as participant_display_name,
               u.avatar_url as participant_avatar_url,
               e.caption,
               (select ev.value from public.entry_evidence ev
                where ev.entry_id = e.id and ev.proof_type in ('PHOTO', 'VIDEO') order by ev.created_at limit 1) as media_url,
               e.submitted_at,
               case when $2 then (select count(*) from public.challenge_votes v where v.entry_id = e.id) else null end as votes
        from public.quest_entries e
        join public.users u on u.id = e.participant_id
        where e.quest_id = $1
        order by e.submitted_at, e.id
        "#,
    )
    .bind(quest_id)
    .bind(phase == "CLOSED")
    .fetch_all(&state.database)
    .await
    .map_err(db)?;
    let viewer_vote = sqlx::query_scalar::<_, Uuid>(
        "select entry_id from public.challenge_votes where quest_id = $1 and voter_id = $2",
    )
    .bind(quest_id)
    .bind(user.id)
    .fetch_optional(&state.database)
    .await
    .map_err(db)?;
    let viewer_can_vote = phase == "VOTING"
        && viewer_vote.is_none()
        && candidates
            .iter()
            .any(|candidate| candidate.participant_id != user.id);
    Ok(web::Json(VoteBallot {
        quest_id,
        title,
        group_name,
        deadline,
        votes_close_at: closes,
        phase,
        winner_count,
        viewer_vote,
        viewer_can_vote,
        candidates,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CastVote {
    entry_id: Uuid,
}

#[post("/quests/{quest_id}/vote")]
pub async fn cast_vote(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
    body: web::Json<CastVote>,
) -> Result<HttpResponse, FriendsError> {
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    if !in_room(&state, quest_id, user.id).await? {
        return Err(FriendsError::NotInRoom);
    }
    let mut transaction = state.database.begin().await.map_err(db)?;
    let (deadline, closes, method) = sqlx::query_as::<_, (DateTime<Utc>, DateTime<Utc>, String)>(
        r#"select deadline, coalesce(votes_close_at, deadline + interval '24 hours'),
                  winner_selection_method::text
           from public.quests where id = $1 for update"#,
    )
    .bind(quest_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(db)?;
    if method != "ROOM_VOTE" || vote_phase(Utc::now(), deadline, closes) != "VOTING" {
        return Err(FriendsError::VotingClosed);
    }
    let author = sqlx::query_scalar::<_, Uuid>(
        "select participant_id from public.quest_entries where id = $1 and quest_id = $2",
    )
    .bind(body.entry_id)
    .bind(quest_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(db)?
    .ok_or(FriendsError::NotFound)?;
    if author == user.id {
        return Err(FriendsError::SelfVote);
    }
    let inserted = sqlx::query(
        "insert into public.challenge_votes (quest_id, voter_id, entry_id) values ($1, $2, $3) on conflict do nothing",
    )
    .bind(quest_id)
    .bind(user.id)
    .bind(body.entry_id)
    .execute(&mut *transaction)
    .await
    .map_err(db)?;
    if inserted.rows_affected() == 0 {
        return Err(FriendsError::AlreadyVoted);
    }
    transaction.commit().await.map_err(db)?;
    Ok(HttpResponse::NoContent().finish())
}

/// Picks winners from vote counts. Ties share the win: every entry tied with the last
/// winning count also wins, so a tie can produce more winners than `winner_count`, capped
/// at 3 positions by the schema. Returns an empty list for "no contest".
pub fn tally_winners(
    tallies: &[(Uuid, i64)],
    winner_count: usize,
    total_votes: usize,
) -> Vec<Uuid> {
    if tallies.len() < MIN_ENTRIES_FOR_CONTEST || total_votes < MIN_VOTES_FOR_CONTEST {
        return Vec::new();
    }
    let mut ranked: Vec<&(Uuid, i64)> = tallies.iter().filter(|(_, votes)| *votes > 0).collect();
    ranked.sort_by_key(|(_, votes)| std::cmp::Reverse(*votes));
    let Some(cutoff) = ranked
        .get(winner_count.saturating_sub(1))
        .or(ranked.last())
        .map(|(_, votes)| *votes)
    else {
        return Vec::new();
    };
    ranked
        .into_iter()
        .take_while(|(_, votes)| *votes >= cutoff)
        .take(3)
        .map(|(entry, _)| *entry)
        .collect()
}

/// Closes room votes whose window has ended: writes winners (or no contest) and finalizes.
pub async fn close_votes_once(state: &AppState) -> Result<u64, sqlx::Error> {
    let due = sqlx::query_as::<_, (Uuid, i16)>(
        r#"
        select id, winner_count from public.quests
        where winner_selection_method = 'ROOM_VOTE'
          and status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING')
          and coalesce(votes_close_at, deadline + interval '24 hours') <= now()
        limit 25
        "#,
    )
    .fetch_all(&state.database)
    .await?;
    let mut closed = 0;
    for (quest_id, winner_count) in due {
        let mut transaction = state.database.begin().await?;
        let still_open = sqlx::query_scalar::<_, bool>(
            "select status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING') from public.quests where id = $1 for update",
        )
        .bind(quest_id)
        .fetch_one(&mut *transaction)
        .await?;
        if !still_open {
            continue;
        }
        let tallies = sqlx::query_as::<_, (Uuid, i64)>(
            r#"select e.id, (select count(*) from public.challenge_votes v where v.entry_id = e.id)
               from public.quest_entries e where e.quest_id = $1 order by e.submitted_at, e.id"#,
        )
        .bind(quest_id)
        .fetch_all(&mut *transaction)
        .await?;
        let total_votes = tallies.iter().map(|(_, votes)| *votes as usize).sum();
        let winners = tally_winners(&tallies, winner_count as usize, total_votes);
        for (index, entry_id) in winners.iter().enumerate() {
            sqlx::query(
                "insert into public.quest_winners (quest_id, entry_id, winner_position) values ($1, $2, $3) on conflict do nothing",
            )
            .bind(quest_id)
            .bind(entry_id)
            .bind((index + 1) as i16)
            .execute(&mut *transaction)
            .await?;
        }
        sqlx::query(
            r#"update public.quests set status = 'FINALIZED', closed_at = coalesce(closed_at, now()),
               votes_close_at = coalesce(votes_close_at, deadline + interval '24 hours'), updated_at = now()
               where id = $1"#,
        )
        .bind(quest_id)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        closed += 1;
    }
    Ok(closed)
}

#[allow(clippy::too_many_arguments)]
pub async fn notify(
    transaction: &mut Transaction<'_, Postgres>,
    user_id: Uuid,
    actor_id: Option<Uuid>,
    quest_id: Option<Uuid>,
    kind: &str,
    title: &str,
    body: &str,
    href: &str,
) -> Result<(), FriendsError> {
    sqlx::query(
        r#"insert into public.notifications (user_id, actor_id, quest_id, kind, title, body, href)
           values ($1, $2, $3, $4::notification_kind, $5, $6, $7)"#,
    )
    .bind(user_id)
    .bind(actor_id)
    .bind(quest_id)
    .bind(kind)
    .bind(title)
    .bind(body)
    .bind(href)
    .execute(&mut **transaction)
    .await
    .map(|_| ())
    .map_err(db)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    #[test]
    fn no_contest_without_two_entries_and_two_votes() {
        assert!(tally_winners(&[(id(1), 3)], 1, 3).is_empty());
        assert!(tally_winners(&[(id(1), 1), (id(2), 0)], 1, 1).is_empty());
    }

    #[test]
    fn highest_vote_wins() {
        let winners = tally_winners(&[(id(1), 1), (id(2), 3), (id(3), 0)], 1, 4);
        assert_eq!(winners, vec![id(2)]);
    }

    #[test]
    fn ties_share_the_win() {
        let winners = tally_winners(&[(id(1), 2), (id(2), 2), (id(3), 1)], 1, 5);
        assert_eq!(winners.len(), 2);
        assert!(winners.contains(&id(1)) && winners.contains(&id(2)));
    }

    #[test]
    fn ties_never_exceed_three_positions() {
        let tallies = [(id(1), 1), (id(2), 1), (id(3), 1), (id(4), 1)];
        assert_eq!(tally_winners(&tallies, 1, 4).len(), 3);
    }

    #[test]
    fn entries_with_no_votes_never_win() {
        let winners = tally_winners(&[(id(1), 2), (id(2), 0)], 2, 2);
        assert_eq!(winners, vec![id(1)]);
    }

    #[test]
    fn vote_phases_follow_the_window() {
        let deadline = Utc::now();
        let closes = deadline + chrono::Duration::hours(VOTE_WINDOW_HOURS);
        assert_eq!(
            vote_phase(deadline - chrono::Duration::minutes(1), deadline, closes),
            "SUBMITTING"
        );
        assert_eq!(
            vote_phase(deadline + chrono::Duration::hours(1), deadline, closes),
            "VOTING"
        );
        assert_eq!(vote_phase(closes, deadline, closes), "CLOSED");
    }

    #[test]
    fn group_names_are_bounded() {
        assert!(
            CreateGroup {
                name: "Lekki Crew".into(),
                member_ids: vec![]
            }
            .validate()
            .is_ok()
        );
        assert!(
            CreateGroup {
                name: "x".into(),
                member_ids: vec![]
            }
            .validate()
            .is_err()
        );
    }
}
