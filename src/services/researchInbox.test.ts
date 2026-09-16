import { describe, expect, it } from "vitest";
import { createReviewFixtures, REVIEW_NOW } from "../ui-review/fixtures";
import { buildResearchInbox, inboxEventDate } from "./researchInbox";
import { buildReviewTasks } from "./reviewTaskProvider";

function input() {
  const fixture = createReviewFixtures("full");
  return { events: fixture.snapshot.events, tasks: fixture.tasks, watchItems: fixture.watchItems, now: REVIEW_NOW, timeZone: "Asia/Shanghai" };
}

describe("Research Inbox deterministic read projection", () => {
  it("returns the same rows under input permutation without mutating owners", () => {
    const data = input(); const before = JSON.stringify(data);
    const rows = buildResearchInbox(data);
    expect(buildResearchInbox({ ...data, events: [...data.events].reverse(), tasks: [...data.tasks].reverse(), watchItems: [...data.watchItems].reverse() })).toEqual(rows);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("groups every pending task per watch item and consumes referenced events once", () => {
    const data = input();
    data.tasks.push({ ...data.tasks[0], id: "second-rule", relatedEventIds: [data.events[0].id, data.events[6].id] });
    data.tasks.push(data.tasks[0]);
    const rows = buildResearchInbox(data);
    const group = rows.find(row => row.watchItem?.id === data.watchItems[0].id)!;
    expect(group.tasks).toHaveLength(2);
    expect(group.events.map(event => event.id)).toEqual([data.events[0].id, data.events[6].id]);
    expect(rows.flatMap(row => row.events).filter(event => event.id === data.events[0].id)).toHaveLength(1);
  });
  it("orders overdue, due, pending and event statuses using severity then date then stable IDs", () => {
    const data = input();
    data.tasks[0] = { ...data.tasks[0], severity: "low", dueAt: "2026-09-08" };
    data.tasks[1] = { ...data.tasks[1], severity: "high", dueAt: "2026-09-09" };
    data.tasks[2] = { ...data.tasks[2], severity: "high", dueAt: null };
    data.events[7].reviewStatus = "not_required";
    const rows = buildResearchInbox(data);
    expect(rows.slice(0, 3).map(row => row.bucket)).toEqual(["overdue", "due", "pending"]);
    expect(rows[0].reason).toContain("逾期");
    expect(rows.at(-1)?.bucket).toBe("recent");
    data.tasks[0].dueAt = "2026-09-09";
    expect(buildResearchInbox(data)[0].watchItem?.id).toBe(data.watchItems[1].id);
  });
  it.each(["acknowledged", "dismissed", "snoozed"] as const)("does not revive a %s task as a high priority event", status => {
    const data = input(); data.tasks[0].status = status;
    expect(buildResearchInbox(data).flatMap(row => row.events).some(event => event.id === data.events[0].id)).toBe(false);
  });
  it("retains missing references and rejects cross-company evidence rather than guessing", () => {
    const data = input(); data.tasks[0].relatedEventIds = ["absent", data.events[1].id];
    const row = buildResearchInbox(data).find(row => row.id === `watch:${data.watchItems[0].id}`)!;
    expect(row.events).toEqual([]); expect(row.unresolvedEventIds).toEqual(["absent", data.events[1].id]);
  });
  it("keeps an orphan task visible without inventing company identity and ignores archived watch tasks", () => {
    const data = input(); data.watchItems[0].archivedAt = "2026-09-08";
    data.tasks[1].watchItemId = "missing-owner";
    const rows = buildResearchInbox(data);
    expect(rows.some(row => row.id === `watch:${data.watchItems[0].id}`)).toBe(false);
    expect(rows.find(row => row.id === "watch:missing-owner")?.stockId).toBeNull();
  });
  it("has a literal empty state", () => {
    expect(buildResearchInbox({ ...input(), events: [], tasks: [], watchItems: [] })).toEqual([]);
  });
  it("uses workflow timezone across midnight and does not use audit/update time for recency", () => {
    const data = input(); data.now = new Date("2026-09-08T16:01:00Z");
    expect(buildResearchInbox(data)[0].bucket).toBe("due");
    expect(buildResearchInbox({ ...data, timeZone: "UTC" })[0].bucket).toBe("pending");
    const event = { ...data.events[0], eventDate: null, publishedAt: "2026-09-09", updatedAt: "2026-09-09", detectedAt: "2026-09-09" };
    expect(inboxEventDate(event, data.timeZone)).toBeNull();
  });
  it("consumes the real task provider without creating or persisting tasks", () => {
    const data = input(); const watchItems = data.watchItems.map(item => ({ ...item, source: "user" as const, createdAt: "2026-08-01", lastReviewedAt: null }));
    const tasks = buildReviewTasks({ ...data, watchItems, taskStates: [], chains: [] });
    const rows = buildResearchInbox({ ...data, watchItems, tasks });
    expect(rows.flatMap(row => row.tasks).map(task => task.id).sort()).toEqual(tasks.map(task => task.id).sort());
    expect(buildReviewTasks({ ...data, watchItems, taskStates: [], chains: [] })).toEqual(tasks);
  });
});
