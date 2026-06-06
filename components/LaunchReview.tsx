"use client";

/* ------------------------------------------------------------------ */
/*  LaunchReview — pre-launch confirmation modal                       */
/*  Shows exactly which Meta objects will be created, all paused.      */
/* ------------------------------------------------------------------ */

type LaunchReviewNames = {
  audience: string;
  adset: string;
  ad: string;
};

type LaunchReviewProps = {
  open: boolean;
  loading: boolean;
  stageLabel: string;
  mode: "existing" | "new";
  days: number;
  budget: number;
  campaignName: string;
  pixelName: string;
  accountId: string;
  sourceAdName: string;
  names: LaunchReviewNames;
  onConfirm: () => void;
  onCancel: () => void;
};

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({
  className = "h-3.5 w-3.5 text-emerald-400",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PausedChip() {
  return (
    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      Paused
    </span>
  );
}

function ReviewItem({
  index,
  title,
  description,
  metaName,
  paused = true,
}: {
  index: number;
  title: string;
  description: string;
  metaName: string;
  paused?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 p-3.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 text-[11px] font-bold text-blue-300">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-zinc-100">
            {title}
          </span>
          {paused ? <PausedChip /> : null}
        </div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">
          {description}
        </div>
        <div className="mt-1.5 truncate text-[11px] text-zinc-600">
          In Ads Manager: <span className="font-mono">{metaName}</span>
        </div>
      </div>
    </li>
  );
}

export default function LaunchReview({
  open,
  loading,
  stageLabel,
  mode,
  days,
  budget,
  campaignName,
  pixelName,
  accountId,
  sourceAdName,
  names,
  onConfirm,
  onCancel,
}: LaunchReviewProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-review-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl shadow-black/50">
        <h2
          id="launch-review-title"
          className="text-xl font-bold tracking-tight text-white"
        >
          Here's what will be created
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
          Three things will be added to your ad account. All of them start{" "}
          <span className="text-amber-300">paused</span>, so{" "}
          <span className="font-medium text-zinc-200">€0 is spent</span> until
          you switch them on yourself.
        </p>

        {/* Context: existing campaign that will NOT be modified */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
          <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
          <div className="text-[13px] leading-relaxed text-zinc-300">
            Your existing ads keep running exactly as they are —{" "}
            <span className="font-medium text-white">
              nothing you already have is touched
            </span>
            . The new items are added alongside, inside your campaign{" "}
            <span className="font-medium text-white">
              {campaignName || "—"}
            </span>
            .
          </div>
        </div>

        {/* The three objects that will be created */}
        <ul className="mt-4 space-y-2.5">
          <ReviewItem
            index={1}
            title="Who will see the ad"
            description={`People who visited your website in the last ${days} days. Your site's visitor tracking ("${
              pixelName || "—"
            }") already collects this list automatically.`}
            metaName={names.audience}
            paused={false}
          />
          <ReviewItem
            index={2}
            title="How much it can spend"
            description={`Up to €${budget} per day — but only after you switch it on. While paused, it spends €0.`}
            metaName={names.adset}
          />
          <ReviewItem
            index={3}
            title="The ad people will see"
            description={
              mode === "existing"
                ? `An exact copy of your ad "${
                    sourceAdName || "selected ad"
                  }". The original stays untouched and keeps running as before.`
                : "Built from the text and link you wrote in this dashboard."
            }
            metaName={names.ad}
          />
        </ul>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-zinc-500">
          Change your mind later? You can switch everything on, off, or delete
          it in Ads Manager at any time.
          <br />
          <span className="text-[11px] text-zinc-600">
            Ad account: <span className="font-mono">{accountId || "—"}</span>
          </span>
        </p>

        <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[14px] font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[14px] font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:bg-blue-600"
          >
            {loading ? (
              <>
                <Spinner />
                {stageLabel}
              </>
            ) : (
              "Create it — stays paused"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
