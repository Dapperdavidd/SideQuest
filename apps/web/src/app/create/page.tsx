"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ImagePlus, MapPin, UsersRound, WalletCards, X } from "lucide-react";
import { Logo } from "@/components/logo";

type QuestType = "Friends" | "Bounty" | "Explore";
type SelectionMethod = "First valid" | "Best submission";

const stepNames = ["Quest", "People", "Proof", "Winners", "Reward", "Review"];

export default function CreateQuestPage() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questType, setQuestType] = useState<QuestType>("Friends");
  const [isGroup, setIsGroup] = useState(false);
  const [groupSize, setGroupSize] = useState(2);
  const [maxEntries, setMaxEntries] = useState(5);
  const [proof, setProof] = useState<string[]>(["Photo"]);
  const [selectionMethod, setSelectionMethod] = useState<SelectionMethod>("First valid");
  const [winners, setWinners] = useState(1);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(10);
  const [ready, setReady] = useState(false);

  const totalFunding = useMemo(() => rewardAmount * winners, [rewardAmount, winners]);

  function toggleProof(value: string) {
    setProof((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function next() {
    if (step === 0 && (!title.trim() || !description.trim())) return;
    if (step < 5) setStep((value) => value + 1);
    else setReady(true);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8">
        <Logo />
        <Link href="/discover" aria-label="Close quest creator" className="grid h-10 w-10 place-items-center rounded-full border border-line"><X size={19} /></Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-8 lg:py-10">
        <section>
          <div className="overflow-x-auto pb-3">
            <ol className="flex min-w-[620px] items-center">
              {stepNames.map((name, index) => (
                <li key={name} className="flex flex-1 items-center last:flex-none">
                  <button onClick={() => index <= step && setStep(index)} className="flex items-center gap-2 text-left">
                    <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${index <= step ? "bg-accent text-dark" : "bg-[#eceee8] text-muted"}`}>{index < step ? <Check size={15} /> : index + 1}</span>
                    <span className={`text-xs font-semibold ${index === step ? "text-foreground" : "text-muted"}`}>{name}</span>
                  </button>
                  {index < stepNames.length - 1 ? <span className="mx-3 h-px flex-1 bg-line" /> : null}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-line bg-white p-5 shadow-[0_20px_60px_rgba(23,25,23,0.06)] sm:p-8">
            {step === 0 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 1 of 6</p>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">What&apos;s the side quest?</h1>
                <p className="mt-2 text-sm text-muted">Make it sound like something people would actually want to try.</p>
                <label className="mt-7 block text-sm font-bold">Quest title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Take the best sunset photo before 6 PM" /></label>
                <label className="mt-5 block text-sm font-bold">What should people do?<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Give people a clear, fun challenge…" /></label>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {(["Friends", "Bounty", "Explore"] as QuestType[]).map((type) => (
                    <button key={type} onClick={() => setQuestType(type)} className={`rounded-xl border p-4 text-left ${questType === type ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-display font-bold">{type}</span><span className="mt-1 block text-xs leading-5 text-muted">{type === "Friends" ? "Challenge your circle" : type === "Bounty" ? "Offer a small reward" : "Create a real-world mission"}</span></button>
                  ))}
                </div>
                <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-muted/50 py-5 text-sm font-semibold text-muted"><ImagePlus size={19} /> Add a cover image</button>
              </div>
            ) : null}

            {step === 1 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 2 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">Who can take part?</h1><p className="mt-2 text-sm text-muted">Joining shows interest. A slot is only used when an official entry is accepted.</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={() => setIsGroup(false)} className={`rounded-xl border p-5 text-left ${!isGroup ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-bold">Individual</span><span className="mt-1 block text-sm text-muted">One person submits one entry.</span></button><button onClick={() => setIsGroup(true)} className={`rounded-xl border p-5 text-left ${isGroup ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="flex items-center gap-2 font-bold"><UsersRound size={18} /> Group challenge</span><span className="mt-1 block text-sm text-muted">One representative submits for the group.</span></button></div>
                {isGroup ? <label className="mt-5 block text-sm font-bold">Required people, including the submitter<input type="number" min={2} max={50} value={groupSize} onChange={(event) => setGroupSize(Math.max(2, Number(event.target.value)))} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 font-normal" /></label> : null}
                <fieldset className="mt-7"><legend className="text-sm font-bold">Maximum accepted entries</legend><div className="mt-3 flex gap-3">{[3, 5, 10].map((count) => <button key={count} onClick={() => { setMaxEntries(count); setWinners((value) => Math.min(value, count)); }} className={`grid h-12 w-16 place-items-center rounded-xl border font-bold ${maxEntries === count ? "border-dark bg-dark text-white" : "border-line"}`}>{count}</button>)}</div><p className="mt-3 text-xs text-muted">SideQuest never accepts more than 10 official entries.</p></fieldset>
              </div>
            ) : null}

            {step === 2 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 3 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">How do they prove it?</h1><p className="mt-2 text-sm text-muted">Choose one or more evidence types.</p><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">{["Photo", "Video", "Link", "Text", "QR checkpoint", "Location"].map((value) => <button key={value} onClick={() => toggleProof(value)} className={`rounded-xl border p-4 text-left text-sm font-bold ${proof.includes(value) ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}>{proof.includes(value) ? <Check size={16} className="mb-4" /> : <MapPin size={16} className="mb-4 text-muted" />}{value}</button>)}</div></div>
            ) : null}

            {step === 3 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 4 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">How are winners picked?</h1><div className="mt-7 grid gap-3 sm:grid-cols-2">{(["First valid", "Best submission"] as SelectionMethod[]).map((method) => <button key={method} onClick={() => setSelectionMethod(method)} className={`rounded-xl border p-5 text-left ${selectionMethod === method ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-bold">{method}</span><span className="mt-2 block text-sm leading-5 text-muted">{method === "First valid" ? "The earliest qualifying entries win. Submission timestamps cannot be reordered." : "Choose from valid entries using your published criteria."}</span></button>)}</div><fieldset className="mt-7"><legend className="text-sm font-bold">Number of winners</legend><div className="mt-3 flex gap-3">{[1, 2, 3].filter((count) => count <= maxEntries).map((count) => <button key={count} onClick={() => setWinners(count)} className={`grid h-12 w-16 place-items-center rounded-xl border font-bold ${winners === count ? "border-dark bg-dark text-white" : "border-line"}`}>{count}</button>)}</div></fieldset></div>
            ) : null}

            {step === 4 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 5 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">Is there a reward?</h1><div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={() => setRewardEnabled(false)} className={`rounded-xl border p-5 text-left ${!rewardEnabled ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-bold">Just for fun</span><span className="mt-1 block text-sm text-muted">Recognition and achievements.</span></button><button onClick={() => setRewardEnabled(true)} className={`rounded-xl border p-5 text-left ${rewardEnabled ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="flex items-center gap-2 font-bold"><WalletCards size={18} /> Monetary reward</span><span className="mt-1 block text-sm text-muted">Funding must be verified before publishing.</span></button></div>{rewardEnabled ? <div className="mt-6 rounded-xl bg-background p-5"><label className="text-sm font-bold">USD per winner<input type="number" min={1} value={rewardAmount} onChange={(event) => setRewardAmount(Math.max(1, Number(event.target.value)))} className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-lg font-bold" /></label><div className="mt-5 flex items-center justify-between border-t border-line pt-5"><span className="text-sm text-muted">{winners} winner{winners > 1 ? "s" : ""}</span><span className="font-display text-xl font-bold">${totalFunding} total funding</span></div><p className="mt-2 text-xs text-muted">Payment and network fees will be shown separately before approval.</p></div> : null}</div>
            ) : null}

            {step === 5 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 6 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">Ready to publish?</h1><div className="mt-7 divide-y divide-line rounded-xl border border-line">{[["Quest", title || "Untitled quest"], ["Type", questType], ["Participation", isGroup ? `Group of ${groupSize}` : "Individual"], ["Entries", `${maxEntries} maximum`], ["Winners", `${winners} · ${selectionMethod}`], ["Proof", proof.join(", ") || "None selected"], ["Reward", rewardEnabled ? `$${rewardAmount} each · $${totalFunding} total` : "Just for fun"]].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-6 px-4 py-4"><span className="text-sm text-muted">{label}</span><span className="text-right text-sm font-bold">{value}</span></div>)}</div>{rewardEnabled ? <div className="mt-5 rounded-xl bg-[#fff7df] p-4 text-sm leading-6 text-[#72500a]">This quest will enter Awaiting Funding. It will not appear as funded or open until settlement is verified.</div> : null}{ready ? <div className="mt-5 flex items-start gap-3 rounded-xl bg-accent-soft p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent"><Check size={16} /></span><p className="text-sm leading-6"><strong>Draft validated.</strong><br />Connect the database to publish this quest from your account.</p></div> : null}</div>
            ) : null}

            <div className="mt-9 flex items-center justify-between border-t border-line pt-5">
              <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold disabled:opacity-30"><ArrowLeft size={17} /> Back</button>
              <button onClick={next} disabled={(step === 0 && (!title.trim() || !description.trim())) || (step === 2 && proof.length === 0)} className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-dark disabled:cursor-not-allowed disabled:opacity-40">{step === 5 ? (rewardEnabled ? "Continue to funding" : "Publish quest") : "Continue"}<ArrowRight size={17} /></button>
            </div>
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-8 overflow-hidden rounded-[1.5rem] border border-line bg-dark text-white shadow-[0_20px_60px_rgba(23,25,23,0.10)]">
            <div className="grid h-44 place-items-center bg-[radial-gradient(circle_at_75%_20%,rgba(199,255,0,0.38),transparent_24%),linear-gradient(135deg,#2f382a,#111411)]"><ImagePlus className="text-white/35" size={34} /></div>
            <div className="p-5"><span className="rounded-full bg-accent px-2.5 py-1 text-[0.62rem] font-bold uppercase text-dark">{questType}</span><h2 className="mt-4 font-display text-xl font-bold leading-tight">{title || "Your quest title"}</h2><p className="mt-2 text-sm leading-6 text-white/55">{description || "A clear description will help people know exactly what to do."}</p><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[0.06] p-3"><strong>{maxEntries}</strong><span className="mt-1 block text-[0.6rem] text-white/40">entries</span></div><div className="rounded-xl bg-white/[0.06] p-3"><strong>{winners}</strong><span className="mt-1 block text-[0.6rem] text-white/40">winner{winners > 1 ? "s" : ""}</span></div><div className="rounded-xl bg-white/[0.06] p-3"><strong>{rewardEnabled ? `$${rewardAmount}` : "Fun"}</strong><span className="mt-1 block text-[0.6rem] text-white/40">reward</span></div></div><button className="mt-5 w-full rounded-xl bg-accent py-3 text-sm font-bold text-dark">Take this quest</button></div>
          </div>
        </aside>
      </div>
    </main>
  );
}
