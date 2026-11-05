use actix_web::{
    HttpRequest, HttpResponse, ResponseError, delete, get, http::StatusCode, post, web,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::{AppState, auth::AuthError};

#[derive(Debug, Serialize, FromRow)]
pub struct Checkpoint {
    id: Uuid,
    quest_id: Uuid,
    position: i16,
    title: String,
    instructions: Option<String>,
    verification_code: Option<Uuid>,
    completed_at: Option<DateTime<Utc>>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    radius_m: i16,
}

/// A hunt has between 2 and 8 stops (2 is enforced when the quest is published).
pub const MAX_HUNT_STOPS: i16 = 8;
pub const DEFAULT_GEOFENCE_METERS: i16 = 75;

#[derive(Debug, Deserialize)]
pub struct CreateCheckpoint {
    title: String,
    instructions: Option<String>,
    #[serde(default)]
    latitude: Option<f64>,
    #[serde(default)]
    longitude: Option<f64>,
    #[serde(default)]
    radius_m: Option<i16>,
}

impl CreateCheckpoint {
    fn validate(&self) -> Result<(), CheckpointError> {
        if !(2..=100).contains(&self.title.trim().chars().count())
            || self
                .instructions
                .as_deref()
                .is_some_and(|value| !(2..=500).contains(&value.trim().chars().count()))
        {
            return Err(CheckpointError::InvalidCheckpoint);
        }
        match (self.latitude, self.longitude) {
            (None, None) => {}
            (Some(latitude), Some(longitude))
                if latitude.is_finite()
                    && longitude.is_finite()
                    && (-90.0..=90.0).contains(&latitude)
                    && (-180.0..=180.0).contains(&longitude) => {}
            _ => return Err(CheckpointError::InvalidCheckpoint),
        }
        if self
            .radius_m
            .is_some_and(|radius| !(25..=500).contains(&radius))
        {
            return Err(CheckpointError::InvalidCheckpoint);
        }
        Ok(())
    }
}

/// Great-circle distance in metres between two coordinates.
pub fn distance_meters(from: (f64, f64), to: (f64, f64)) -> f64 {
    let (lat1, lon1) = (from.0.to_radians(), from.1.to_radians());
    let (lat2, lon2) = (to.0.to_radians(), to.1.to_radians());
    let a = ((lat2 - lat1) / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * ((lon2 - lon1) / 2.0).sin().powi(2);
    6_371_000.0 * 2.0 * a.sqrt().atan2((1.0 - a).sqrt())
}

#[derive(Debug, Deserialize)]
pub struct CompleteCheckpoint {
    verification_code: Uuid,
    #[serde(default)]
    latitude: Option<f64>,
    #[serde(default)]
    longitude: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct CheckpointCompletion {
    checkpoint_id: Uuid,
    completed_at: DateTime<Utc>,
    completed_count: i64,
    total_count: i64,
    quest_complete: bool,
}

#[derive(Debug, Error)]
pub enum CheckpointError {
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error("quest or checkpoint was not found")]
    NotFound,
    #[error("only the quest creator can manage checkpoints")]
    NotCreator,
    #[error("checkpoints can only be changed while the quest is a draft")]
    QuestLocked,
    #[error("a hunt can have at most eight stops")]
    CheckpointLimit,
    #[error("checkpoint details are invalid")]
    InvalidCheckpoint,
    #[error("join this quest before completing checkpoints")]
    NotParticipant,
    #[error("this quest is not accepting checkpoint progress")]
    QuestClosed,
    #[error("complete the earlier checkpoints first")]
    OutOfOrder,
    #[error("the checkpoint code is invalid")]
    InvalidCode,
    #[error("you need to be at this stop to scan it")]
    OutsideGeofence,
    #[error("checkpoint service is temporarily unavailable")]
    Database,
}

impl ResponseError for CheckpointError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Auth(error) => error.status_code(),
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::NotCreator => StatusCode::FORBIDDEN,
            Self::QuestLocked
            | Self::CheckpointLimit
            | Self::NotParticipant
            | Self::QuestClosed
            | Self::OutOfOrder
            | Self::OutsideGeofence => StatusCode::CONFLICT,
            Self::InvalidCheckpoint | Self::InvalidCode => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Database => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    fn error_response(&self) -> HttpResponse {
        if let Self::Auth(error) = self {
            return error.error_response();
        }
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "code": match self {
                Self::NotFound => "checkpoint_not_found",
                Self::NotCreator => "not_quest_creator",
                Self::QuestLocked => "quest_checkpoints_locked",
                Self::CheckpointLimit => "checkpoint_limit_reached",
                Self::InvalidCheckpoint => "invalid_checkpoint",
                Self::NotParticipant => "quest_not_joined",
                Self::QuestClosed => "quest_not_open",
                Self::OutOfOrder => "checkpoint_out_of_order",
                Self::InvalidCode => "invalid_checkpoint_code",
                Self::OutsideGeofence => "outside_checkpoint_geofence",
                Self::Database => "checkpoint_service_unavailable",
                Self::Auth(_) => unreachable!(),
            },
            "message": self.to_string(),
        }))
    }
}

#[get("/quests/{quest_id}/checkpoints")]
pub async fn list_checkpoints(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
) -> Result<web::Json<Vec<Checkpoint>>, CheckpointError> {
    let viewer = state.auth.authenticate_optional(&request).await?;
    let viewer_id = viewer.map(|user| user.id);
    let quest_id = quest_id.into_inner();
    let accessible = sqlx::query_scalar::<_, bool>(
        r#"
        select exists(
          select 1 from public.quests q
          where q.id = $1
            and (
              (q.visibility = 'PUBLIC' and q.status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED'))
              or ($2::uuid is not null and (
                q.creator_id = $2
                or exists(select 1 from public.quest_participants p where p.quest_id = q.id and p.user_id = $2)
              ))
            )
        )
        "#,
    )
    .bind(quest_id)
    .bind(viewer_id)
    .fetch_one(&state.database)
    .await
    .map_err(|_| CheckpointError::Database)?;
    if !accessible {
        return Err(CheckpointError::NotFound);
    }

    let checkpoints = sqlx::query_as::<_, Checkpoint>(
        r#"
        select c.id,
               c.quest_id,
               c.position,
               c.title,
               c.instructions,
               case when q.creator_id = $2 then c.verification_code else null end as verification_code,
               progress.completed_at,
               c.latitude,
               c.longitude,
               c.radius_m
        from public.quest_checkpoints c
        join public.quests q on q.id = c.quest_id
        left join public.checkpoint_progress progress
          on progress.checkpoint_id = c.id and progress.user_id = $2
        where c.quest_id = $1
        order by c.position
        "#,
    )
    .bind(quest_id)
    .bind(viewer_id)
    .fetch_all(&state.database)
    .await
    .map_err(|_| CheckpointError::Database)?;
    Ok(web::Json(checkpoints))
}

#[post("/quests/{quest_id}/checkpoints")]
pub async fn create_checkpoint(
    request: HttpRequest,
    state: web::Data<AppState>,
    quest_id: web::Path<Uuid>,
    checkpoint: web::Json<CreateCheckpoint>,
) -> Result<(web::Json<Checkpoint>, StatusCode), CheckpointError> {
    checkpoint.validate()?;
    let user = state.auth.authenticate(&request).await?;
    let quest_id = quest_id.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| CheckpointError::Database)?;
    let quest = sqlx::query_as::<_, (Uuid, String)>(
        "select creator_id, status::text from public.quests where id = $1 for update",
    )
    .bind(quest_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| CheckpointError::Database)?
    .ok_or(CheckpointError::NotFound)?;
    if quest.0 != user.id {
        return Err(CheckpointError::NotCreator);
    }
    if quest.1 != "DRAFT" {
        return Err(CheckpointError::QuestLocked);
    }
    let next_position = sqlx::query_scalar::<_, i16>(
        "select (coalesce(max(position), 0) + 1)::smallint from public.quest_checkpoints where quest_id = $1",
    )
    .bind(quest_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| CheckpointError::Database)?;
    if next_position > MAX_HUNT_STOPS {
        return Err(CheckpointError::CheckpointLimit);
    }
    let created = sqlx::query_as::<_, Checkpoint>(
        r#"
        insert into public.quest_checkpoints (quest_id, position, title, instructions, latitude, longitude, radius_m)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, quest_id, position, title, instructions,
                  verification_code, null::timestamptz as completed_at,
                  latitude, longitude, radius_m
        "#,
    )
    .bind(quest_id)
    .bind(next_position)
    .bind(checkpoint.title.trim())
    .bind(checkpoint.instructions.as_deref().map(str::trim))
    .bind(checkpoint.latitude)
    .bind(checkpoint.longitude)
    .bind(checkpoint.radius_m.unwrap_or(DEFAULT_GEOFENCE_METERS))
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| CheckpointError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| CheckpointError::Database)?;
    Ok((web::Json(created), StatusCode::CREATED))
}

#[delete("/quests/{quest_id}/checkpoints/{checkpoint_id}")]
pub async fn delete_checkpoint(
    request: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(Uuid, Uuid)>,
) -> Result<HttpResponse, CheckpointError> {
    let user = state.auth.authenticate(&request).await?;
    let (quest_id, checkpoint_id) = path.into_inner();
    let result = sqlx::query(
        r#"
        delete from public.quest_checkpoints c
        using public.quests q
        where c.id = $1 and c.quest_id = $2 and q.id = c.quest_id
          and q.creator_id = $3 and q.status = 'DRAFT'
        "#,
    )
    .bind(checkpoint_id)
    .bind(quest_id)
    .bind(user.id)
    .execute(&state.database)
    .await
    .map_err(|_| CheckpointError::Database)?;
    if result.rows_affected() == 0 {
        return Err(CheckpointError::NotFound);
    }
    Ok(HttpResponse::NoContent().finish())
}

#[post("/quests/{quest_id}/checkpoints/{checkpoint_id}/complete")]
pub async fn complete_checkpoint(
    request: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(Uuid, Uuid)>,
    completion: web::Json<CompleteCheckpoint>,
) -> Result<web::Json<CheckpointCompletion>, CheckpointError> {
    let user = state.auth.authenticate(&request).await?;
    let (quest_id, checkpoint_id) = path.into_inner();
    let mut transaction = state
        .database
        .begin()
        .await
        .map_err(|_| CheckpointError::Database)?;
    #[allow(clippy::type_complexity)]
    let checkpoint = sqlx::query_as::<
        _,
        (i16, Uuid, String, DateTime<Utc>, bool, bool, Option<f64>, Option<f64>, i16),
    >(
        r#"
        select c.position, c.verification_code, q.status::text, q.deadline,
               exists(select 1 from public.quest_participants p where p.quest_id = q.id and p.user_id = $3),
               q.hunt_ordered, c.latitude, c.longitude, c.radius_m
        from public.quest_checkpoints c
        join public.quests q on q.id = c.quest_id
        where c.id = $1 and c.quest_id = $2
        for update
        "#,
    )
    .bind(checkpoint_id)
    .bind(quest_id)
    .bind(user.id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| CheckpointError::Database)?
    .ok_or(CheckpointError::NotFound)?;
    if !checkpoint.4 {
        return Err(CheckpointError::NotParticipant);
    }
    if checkpoint.2 != "OPEN" || checkpoint.3 <= Utc::now() {
        return Err(CheckpointError::QuestClosed);
    }
    if checkpoint.1 != completion.verification_code {
        return Err(CheckpointError::InvalidCode);
    }
    if let (Some(stop_latitude), Some(stop_longitude)) = (checkpoint.6, checkpoint.7) {
        let inside = match (completion.latitude, completion.longitude) {
            (Some(latitude), Some(longitude)) if latitude.is_finite() && longitude.is_finite() => {
                distance_meters((latitude, longitude), (stop_latitude, stop_longitude))
                    <= f64::from(checkpoint.8)
            }
            _ => false,
        };
        if !inside {
            return Err(CheckpointError::OutsideGeofence);
        }
    }
    let ordered = checkpoint.5;
    let missing_earlier = sqlx::query_scalar::<_, bool>(
        r#"
        select exists(
          select 1 from public.quest_checkpoints earlier
          where earlier.quest_id = $1 and earlier.position < $2
            and not exists(
              select 1 from public.checkpoint_progress progress
              where progress.checkpoint_id = earlier.id and progress.user_id = $3
            )
        )
        "#,
    )
    .bind(quest_id)
    .bind(checkpoint.0)
    .bind(user.id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| CheckpointError::Database)?;
    if ordered && missing_earlier {
        return Err(CheckpointError::OutOfOrder);
    }
    let completed_at = sqlx::query_scalar::<_, DateTime<Utc>>(
        r#"
        insert into public.checkpoint_progress (checkpoint_id, user_id)
        values ($1, $2)
        on conflict (checkpoint_id, user_id)
        do update set completed_at = checkpoint_progress.completed_at
        returning completed_at
        "#,
    )
    .bind(checkpoint_id)
    .bind(user.id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| CheckpointError::Database)?;
    let (completed_count, total_count) = sqlx::query_as::<_, (i64, i64)>(
        r#"
        select count(progress.checkpoint_id), count(c.id)
        from public.quest_checkpoints c
        left join public.checkpoint_progress progress
          on progress.checkpoint_id = c.id and progress.user_id = $2
        where c.quest_id = $1
        "#,
    )
    .bind(quest_id)
    .bind(user.id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| CheckpointError::Database)?;
    transaction
        .commit()
        .await
        .map_err(|_| CheckpointError::Database)?;
    Ok(web::Json(CheckpointCompletion {
        checkpoint_id,
        completed_at,
        completed_count,
        total_count,
        quest_complete: total_count > 0 && completed_count == total_count,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_checkpoint_copy_boundaries() {
        let valid = CreateCheckpoint {
            title: "Find the mural".to_string(),
            instructions: Some("Scan the code beside the entrance.".to_string()),
            latitude: Some(6.5095),
            longitude: Some(3.3711),
            radius_m: Some(75),
        };
        assert!(valid.validate().is_ok());

        let half_located = CreateCheckpoint {
            longitude: None,
            ..valid
        };
        assert!(matches!(
            half_located.validate(),
            Err(CheckpointError::InvalidCheckpoint)
        ));

        let invalid = CreateCheckpoint {
            title: "x".to_string(),
            instructions: None,
            latitude: None,
            longitude: None,
            radius_m: None,
        };
        assert!(matches!(
            invalid.validate(),
            Err(CheckpointError::InvalidCheckpoint)
        ));
    }

    #[test]
    fn geofence_distance_matches_known_points() {
        let yaba = (6.5095, 3.3711);
        let nearby = (6.5100, 3.3711);
        let distance = distance_meters(yaba, nearby);
        assert!((50.0..=60.0).contains(&distance), "{distance}");
        assert!(distance_meters(yaba, (6.4281, 3.4219)) > 10_000.0);
    }
}
