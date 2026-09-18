/**
 * GitHub is the loop's memory: issues are the ledger, labels are the stage, comments are the
 * record of each stage, pull requests are the hand-over. Any runner on any machine can pick
 * an issue up from here. Bodies go in over stdin, so their text is never on a command line.
 */
import { must, run } from "./env.ts";
import { LABELS, MANAGED, type ReviewComment, STAGES, type Stage, stageLabel } from "./flow.ts";

export interface Issue {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED";
  stateReason: string | null;
  closedAt: string | null;
  createdAt: string;
  author: string;
  labels: string[];
}

interface RawIssue extends Omit<Issue, "author" | "labels"> {
  author: { login: string } | null;
  labels: { name: string }[];
}

const FIELDS = "number,title,body,state,stateReason,closedAt,createdAt,author,labels";

export function listIssues(label: string, state: "open" | "all"): Issue[] {
  const out = must(
    run("gh", [
      "issue",
      "list",
      "--label",
      label,
      "--state",
      state,
      "--limit",
      "200",
      "--json",
      FIELDS,
    ]),
    "gh issue list",
  );
  return (JSON.parse(out) as RawIssue[])
    .map((i) => ({ ...i, author: i.author?.login ?? "", labels: i.labels.map((l) => l.name) }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createIssue(title: string, body: string, labels: readonly string[]): string {
  const args = ["issue", "create", "--title", title, "--body-file", "-"];
  for (const label of labels) args.push("--label", label);
  return must(run("gh", args, { input: body }), "gh issue create").trim();
}

export const comment = (issue: number, body: string): void => {
  must(
    run("gh", ["issue", "comment", String(issue), "--body-file", "-"], { input: body }),
    "comment",
  );
};

export const reopen = (issue: number, why: string): void => {
  must(run("gh", ["issue", "reopen", String(issue), "--comment", why]), "gh issue reopen");
};

/** Moves an issue to a stage: the one stage label it carries, plus any others to add. */
export function moveTo(issue: Issue, stage: Stage, add: readonly string[] = []): void {
  const args = [
    "issue",
    "edit",
    String(issue.number),
    "--add-label",
    [MANAGED, stageLabel(stage), ...add].join(","),
  ];
  const stale = STAGES.filter((s) => s !== stage && issue.labels.includes(stageLabel(s)));
  if (stale.length > 0) args.push("--remove-label", stale.map(stageLabel).join(","));
  must(run("gh", args), "gh issue edit");
}

export const openLoopPullRequests = (): number =>
  (
    JSON.parse(
      must(
        run("gh", [
          "pr",
          "list",
          "--label",
          "playtest-loop",
          "--state",
          "open",
          "--json",
          "number",
        ]),
        "gh pr list",
      ),
    ) as unknown[]
  ).length;

export function openPullRequest(o: {
  branch: string;
  base: string;
  title: string;
  body: string;
  draft: boolean;
}): string {
  const args = ["pr", "create", "--head", o.branch, "--base", o.base, "--title", o.title];
  args.push("--label", "playtest-loop", "--body-file", "-");
  if (o.draft) args.push("--draft");
  return must(run("gh", args, { input: o.body }), "gh pr create").trim();
}

export interface PullRequest {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  headRefOid: string;
  url: string;
}

/** The pull request for a branch, open or not. The newest, if a branch has had several. */
export function pullRequestOf(branch: string): PullRequest | null {
  const out = must(
    run("gh", [
      "pr",
      "list",
      "--head",
      branch,
      "--state",
      "all",
      "--limit",
      "1",
      "--json",
      "number,state,headRefOid,url",
    ]),
    "gh pr list",
  );
  return (JSON.parse(out) as PullRequest[])[0] ?? null;
}

/** How one named check run ended on a commit: "success", "failure", or null while it runs. */
export function checkConclusion(sha: string, name: string): string | null {
  const out = must(
    run("gh", ["api", `repos/{owner}/{repo}/commits/${sha}/check-runs`, "--paginate"]),
    "check runs",
  );
  const runs = (JSON.parse(out) as { check_runs: { name: string; conclusion: string | null }[] })
    .check_runs;
  return runs.find((r) => r.name === name)?.conclusion ?? null;
}

interface RawReviewComment {
  id: number;
  in_reply_to_id?: number;
  user: { login: string } | null;
  path: string;
  line: number | null;
  body: string;
}

export function reviewComments(pr: number): ReviewComment[] {
  const out = must(
    run("gh", ["api", `repos/{owner}/{repo}/pulls/${pr}/comments`, "--paginate"]),
    "review comments",
  );
  return (JSON.parse(out) as RawReviewComment[]).map((c) => ({
    id: c.id,
    inReplyTo: c.in_reply_to_id ?? null,
    author: c.user?.login ?? "",
    path: c.path,
    line: c.line,
    body: c.body,
  }));
}

export const replyOnThread = (pr: number, comment: number, body: string): void => {
  const path = `repos/{owner}/{repo}/pulls/${pr}/comments/${comment}/replies`;
  must(run("gh", ["api", "-X", "POST", path, "-F", "body=@-"], { input: body }), "reply");
};

/** The account the loop acts as. Its own comments are never findings. */
export const whoAmI = (): string =>
  must(run("gh", ["api", "user", "-q", ".login"]), "gh api user").trim();

export function ensureLabels(): void {
  for (const [name, description] of Object.entries(LABELS))
    must(
      run("gh", ["label", "create", name, "--description", description, "--force"]),
      `label ${name}`,
    );
}
