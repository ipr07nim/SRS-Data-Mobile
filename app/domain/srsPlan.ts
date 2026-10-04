// Roll-day planning state, derived by replaying the backend's append-only edit log. The
// server stores events without interpreting them, so this reducer is the only definition of
// what an event means -- keep it pure so both the desktop page and the mobile build can use it.

export const HOME_TEAM = "Spirit";      // whose next roll the ETA counts down to

export type PlanEventType = "set" | "clear" | "undo_clear";
export type PlanTarget = "day" | "team" | "roll" | "entry";

export interface PlanEvent {
    seq: number;
    client_id: string;
    type: PlanEventType;
    target?: PlanTarget | null;
    // Natural keys: team name, roll number, or `${roll_number}:${buggy_id}` for an entry.
    target_id?: string | null;
    field?: string | null;
    value?: any;
    created_at?: string;
}

export interface PlanTeam {
    time: string | null;                // when they were cleared to roll, today
    scratched: boolean;
}

export interface PlanEntry {
    driver: string;                     // Driver.name
    wheels: string;
    heat: number | null;
    bags: number | null;
    hill2: number;                      // 0 drop .. 1 full, continuous
    tree: string;                       // where the flagger stands
    mech_br: string;
    mech_bl: string;
    mech_front: string;
    scratched: boolean;
    roll_id: number | null;             // set once promoted to a real Roll
}

export interface PlanRoll {
    number: number;
    time: string | null;
    entries: Record<number, PlanEntry | undefined>;   // keyed by buggy id
    // Pushers line up by position in the roll rather than by buggy, so a pusher set is a
    // numbered slot: hills[2][3] is who pushes hill 3 for the second set.
    hills: Record<number, Record<number, string | undefined> | undefined>;
    // Column orders, absent until someone reorders. `order` lists buggy ids and `hills_order`
    // slot numbers, so the buggies and the pusher sets move independently.
    order?: Array<number>;
    hills_order?: Array<number>;
}

export interface PlanState {
    teamOrder: Array<string>;
    teams: Record<string, PlanTeam | undefined>;
    rollingTeam: string | null;         // who is on the course now
    rolls: Record<number, PlanRoll | undefined>;
    hiddenBuggies: Array<number>;
    currentRoll: number;
    clearStack: Array<ClearFrame>;
}

// Enough to reverse one clear. Kept here rather than in the event payload so that two clients
// undoing at once cannot each apply their own idea of the previous value.
interface ClearFrame {
    team: string;
    prevTime: string | null;
    prevRollingTeam: string | null;
    prevCurrentRoll: number;
}

export function emptyPlanState(): PlanState {
    return {
        teamOrder: [], teams: {}, rollingTeam: null, rolls: {}, hiddenBuggies: [],
        currentRoll: 1, clearStack: [],
    };
}

export const entryKey = (rollNumber: number, buggyId: number) => `${rollNumber}:${buggyId}`;

const isHome = (name: string) => name.toLowerCase() === HOME_TEAM.toLowerCase();

function emptyTeam(): PlanTeam {
    return { time: null, scratched: false };
}

function emptyEntry(): PlanEntry {
    return {
        driver: "", wheels: "", heat: null, bags: null, hill2: 1, tree: "",
        mech_br: "", mech_bl: "", mech_front: "", scratched: false, roll_id: null,
    };
}

function emptyRoll(number: number): PlanRoll {
    return { number, time: null, entries: {}, hills: {} };
}

function getTeam(state: PlanState, name: string): PlanTeam {
    const existing = state.teams[name];
    if (existing) return existing;
    const created = emptyTeam();
    state.teams[name] = created;
    return created;
}

// A roll exists as soon as anything in it has been set; there is no "create roll" event.
function getRoll(state: PlanState, number: number): PlanRoll {
    const existing = state.rolls[number];
    if (existing) return existing;
    const created = emptyRoll(number);
    state.rolls[number] = created;
    return created;
}

function getEntry(state: PlanState, rollNumber: number, buggyId: number): PlanEntry {
    const roll = getRoll(state, rollNumber);
    const existing = roll.entries[buggyId];
    if (existing) return existing;
    const created = emptyEntry();
    roll.entries[buggyId] = created;
    return created;
}

function parseEntryId(targetId: string): [number, number] | null {
    const [roll, buggy] = targetId.split(":");
    const rollNumber = Number(roll), buggyId = Number(buggy);
    if (!Number.isFinite(rollNumber) || !Number.isFinite(buggyId)) return null;
    return [rollNumber, buggyId];
}

// The non-scratched teams, in roll order.
export function activeOrder(state: PlanState): Array<string> {
    return state.teamOrder.filter(name => !state.teams[name]?.scratched);
}

// Who the Clear button sits on: the next non-scratched team after whoever is rolling.
export function nextTeam(state: PlanState): string | null {
    const order = activeOrder(state);
    if (order.length === 0) return null;
    const i = state.rollingTeam ? order.indexOf(state.rollingTeam) : -1;
    return order[(i + 1) % order.length];
}

// How many team slots -- including the one on the course right now -- come before Spirit is
// up. Null when Spirit is not in the order, so the UI shows no estimate rather than a guess.
export function teamsAhead(state: PlanState): number | null {
    const order = activeOrder(state);
    const spirit = order.find(isHome);
    if (!spirit) return null;

    const spiritPos = order.indexOf(spirit);
    const from = state.rollingTeam ? order.indexOf(state.rollingTeam) : -1;
    if (from < 0) return spiritPos;             // nothing rolling yet: just the queue before them

    const diff = (spiritPos - from + order.length) % order.length;
    return diff === 0 ? order.length : diff;    // Spirit rolling now => a full lap until the next
}

export const DEFAULT_ROLL_TIME = 2.5;
export const DEFAULT_ROLL_TIME_SD = 1.5;

export function etaMinutes(state: PlanState): [number, number] | null {
    const ahead = teamsAhead(state);
    if (ahead === null) return null;

    // Very roughly estimated from zello logs to get ~95% confidence band
    const center = DEFAULT_ROLL_TIME * ahead;
    const spread = DEFAULT_ROLL_TIME_SD * Math.sqrt(ahead)
    return [Math.round(center - spread), Math.round(center + spread)];
}

export type RollOrderField = "order" | "hills_order";

/** Stored order first, restricted to what is on show, then anything it does not mention. */
function ordered(stored: Array<number> | undefined, all: Array<number>): Array<number> {
    const kept = (stored ?? []).filter(id => all.includes(id));
    return [...kept, ...all.filter(id => !kept.includes(id))];
}

/** The buggies of a roll, in column order. */
export const rollOrder = (roll: PlanRoll, buggyIds: Array<number>) =>
    ordered(roll.order, buggyIds);

/** The pusher-set slots of a roll, in column order. Slots are numbered from 1. */
export const hillOrder = (roll: PlanRoll, count: number) =>
    ordered(roll.hills_order, Array.from({ length: count }, (_, i) => i + 1));

/** Swaps an item with its neighbour in one of the two column orders. Null at either end. */
export function moveOrder(rollNumber: number, order: Array<number>, item: number, delta: number,
    field: RollOrderField): PlanEventDraft | null {
    const from = order.indexOf(item);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return null;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    return setRoll(rollNumber, field, next);
}

export function sortedRolls(state: PlanState): Array<PlanRoll> {
    return Object.values(state.rolls)
        .filter((roll): roll is PlanRoll => roll !== undefined)
        .sort((a, b) => a.number - b.number);
}

function applySet(state: PlanState, event: PlanEvent) {
    const { target, target_id: id, field, value } = event;
    if (!field) return;

    if (target === "day") {
        if (field === "team_order") state.teamOrder = Array.isArray(value) ? [...value] : [];
        else if (field === "hidden_buggies") state.hiddenBuggies = Array.isArray(value) ? [...value] : [];
        else if (field === "current_roll") state.currentRoll = Number(value);
        return;
    }
    if (!id) return;

    if (target === "team") {
        // Unknown fields are assigned as-is, so a newer client can add one without a migration
        // here or on the server; this reducer just carries it.
        (getTeam(state, id) as any)[field] = value;
    } else if (target === "roll") {
        const roll = getRoll(state, Number(id));
        const pusher = /^hills\.(\d+)\.(\d+)$/.exec(field);
        if (pusher) (roll.hills[Number(pusher[1])] ??= {})[Number(pusher[2])] = value;
        else (roll as any)[field] = value;
    } else if (target === "entry") {
        const parsed = parseEntryId(id);
        if (!parsed) return;
        (getEntry(state, parsed[0], parsed[1]) as any)[field] = value;
    }
}

function applyClear(state: PlanState, event: PlanEvent) {
    const team = event.target_id;
    if (!team) return;

    state.clearStack.push({
        team,
        prevTime: state.teams[team]?.time ?? null,
        prevRollingTeam: state.rollingTeam,
        prevCurrentRoll: state.currentRoll,
    });

    // Spirit's roll ends when the team after them is cleared, so that is when the day moves on.
    if (state.rollingTeam && isHome(state.rollingTeam)) state.currentRoll += 1;

    getTeam(state, team).time = event.value?.time ?? null;
    state.rollingTeam = team;
}

function applyUndoClear(state: PlanState) {
    const frame = state.clearStack.pop();
    if (!frame) return;
    getTeam(state, frame.team).time = frame.prevTime;
    state.rollingTeam = frame.prevRollingTeam;
    state.currentRoll = frame.prevCurrentRoll;
}

/** Replay the log into planning state. Events must be in `seq` order. */
export function reducePlan(events: Array<PlanEvent>): PlanState {
    const state = emptyPlanState();
    for (const event of events) {
        switch (event.type) {
            case "set": applySet(state, event); break;
            case "clear": applyClear(state, event); break;
            case "undo_clear": applyUndoClear(state); break;
            // Unknown types are skipped, so an older client stays usable against a newer one.
        }
    }
    return state;
}

// --- event builders -------------------------------------------------------------------
// The one place events are constructed, so the page and the mobile build cannot drift on
// how a field is addressed.

/** An event before the server has ordered it. */
export type PlanEventDraft = Omit<PlanEvent, "seq" | "client_id" | "created_at">;

export const setDay = (field: string, value: any): PlanEventDraft =>
    ({ type: "set", target: "day", field, value });

export const setTeam = (name: string, field: string, value: any): PlanEventDraft =>
    ({ type: "set", target: "team", target_id: name, field, value });

export const setRoll = (rollNumber: number, field: string, value: any): PlanEventDraft =>
    ({ type: "set", target: "roll", target_id: String(rollNumber), field, value });

export const setEntry = (rollNumber: number, buggyId: number, field: string, value: any): PlanEventDraft =>
    ({ type: "set", target: "entry", target_id: entryKey(rollNumber, buggyId), field, value });

export const setPusher = (rollNumber: number, slot: number, hill: number, pusher: string) =>
    setRoll(rollNumber, `hills.${slot}.${hill}`, pusher);

export const clearTeam = (name: string, time: string): PlanEventDraft =>
    ({ type: "clear", target: "team", target_id: name, value: { time } });

export const undoClear = (name: string): PlanEventDraft =>
    ({ type: "undo_clear", target: "team", target_id: name });

/**
 * "+ Add roll": there is no create-roll event, so the roll materialises by writing each active
 * buggy's driver, carried over from the roll before it. That is the value you normally want
 * anyway, and it means every client sees the new roll.
 */
export function addRollEvents(state: PlanState, activeBuggyIds: Array<number>): Array<PlanEventDraft> {
    const rolls = sortedRolls(state);
    const previous = rolls.at(-1);
    const number = previous ? previous.number + 1 : 1;
    return activeBuggyIds.map(buggyId =>
        setEntry(number, buggyId, "driver", previous?.entries[buggyId]?.driver ?? ""));
}
