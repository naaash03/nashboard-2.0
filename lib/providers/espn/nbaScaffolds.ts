import { randomUUID } from "node:crypto";
import type { Meta } from "@/lib/providers/types";

type DemoDataMode = "auto" | "live" | "fixture";
type MatchupEdge = "away" | "home" | "even";
type RestEdge = "team" | "opponent" | "even";
type SpotSignal = "positive" | "warning" | "neutral";
type FormSignal = "hot" | "steady" | "cool";
type TrendSignal = "up" | "steady" | "down";

export type NbaScenarioOption = {
  id: string;
  label: string;
};

export type NbaTeamMatchupProfileRaw = {
  id: string;
  label: string;
  matchup: string;
  context: string;
  beginnerSummary: string;
  advancedSummary: string;
  away: {
    key: string;
    name: string;
    record: string;
    identity: string;
  };
  home: {
    key: string;
    name: string;
    record: string;
    identity: string;
  };
  pillars: Array<{
    id: string;
    label: string;
    awayValue: string;
    homeValue: string;
    edge: MatchupEdge;
    takeaway: string;
    whyItMatters: string;
  }>;
  swingFactor: {
    title: string;
    summary: string;
  };
  teachingPoints: string[];
};

export type NbaRestScheduleSpotRaw = {
  id: string;
  label: string;
  team: {
    key: string;
    name: string;
    record: string;
  };
  opponent: {
    key: string;
    name: string;
    record: string;
  };
  spotLabel: string;
  signal: SpotSignal;
  context: string;
  beginnerSummary: string;
  advancedSummary: string;
  factors: Array<{
    label: string;
    teamValue: string;
    opponentValue: string;
    edge: RestEdge;
    takeaway: string;
    whyItMatters: string;
  }>;
  recentWindow: Array<{
    dateLabel: string;
    site: "vs" | "@";
    opponent: string;
    result?: string;
    note: string;
  }>;
  nextWindow: Array<{
    dateLabel: string;
    site: "vs" | "@";
    opponent: string;
    note: string;
  }>;
  teachingPoints: string[];
};

export type NbaPlayerRoleFormRaw = {
  id: string;
  label: string;
  player: {
    fullName: string;
    teamKey: string;
    teamName: string;
    position: string;
    role: string;
    archetype: string;
  };
  form: FormSignal;
  context: string;
  beginnerSummary: string;
  advancedSummary: string;
  metrics: Array<{
    label: string;
    seasonValue: string;
    recentValue: string;
    trend: TrendSignal;
    takeaway: string;
  }>;
  roleSignals: Array<{
    label: string;
    value: string;
    explanation: string;
  }>;
  recentGames: Array<{
    dateLabel: string;
    opponent: string;
    line: string;
    roleNote: string;
  }>;
  teachingPoints: string[];
};

export type TeamMatchupDemoData = NbaTeamMatchupProfileRaw & {
  selectedScenarioId: string;
  availableScenarios: NbaScenarioOption[];
  sourceLabel: string;
};

export type RestScheduleDemoData = NbaRestScheduleSpotRaw & {
  selectedScenarioId: string;
  availableScenarios: NbaScenarioOption[];
  sourceLabel: string;
};

export type PlayerRoleFormDemoData = NbaPlayerRoleFormRaw & {
  selectedScenarioId: string;
  availableScenarios: NbaScenarioOption[];
  sourceLabel: string;
};

function buildMeta(dataMode: DemoDataMode, note: string, warning?: string): Meta {
  return {
    sourceUsed: "demo",
    updatedAt: new Date().toISOString(),
    requestId: randomUUID(),
    dataMode,
    warning,
    notes: [
      note,
      "Demo-backed scaffold so the widget renders without extra NBA provider setup.",
      "Live enrichment is intentionally deferred for a later NBA data pass.",
    ],
  };
}

function resolveScenario<T extends { id: string; label: string }>(
  rows: T[],
  requestedId: string | undefined,
): { selected: T; warning?: string } {
  const normalized = requestedId?.trim();
  if (!normalized) {
    return { selected: rows[0] };
  }

  const selected = rows.find((row) => row.id === normalized);
  if (selected) {
    return { selected };
  }

  return {
    selected: rows[0],
    warning: `Unknown demo scenario '${normalized}'. Falling back to ${rows[0].label}.`,
  };
}

function scenarioOptions<T extends { id: string; label: string }>(rows: T[]): NbaScenarioOption[] {
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

const TEAM_MATCHUP_SCENARIOS: NbaTeamMatchupProfileRaw[] = [
  {
    id: "bos-at-nyk",
    label: "Celtics at Knicks",
    matchup: "Boston Celtics at New York Knicks",
    context: "Demo scouting board for half-court shot quality versus second-chance pressure.",
    beginnerSummary:
      "Boston brings the cleaner spacing profile, but New York can bend the matchup by winning the glass and creating extra shots.",
    advancedSummary:
      "Boston owns the stronger shot map and lower-turnover attack. New York's best path is to turn missed first shots into second possessions and force Boston into longer defensive shifts.",
    away: {
      key: "BOS",
      name: "Boston Celtics",
      record: "58-24",
      identity: "5-out spacing and low-turnover offense",
    },
    home: {
      key: "NYK",
      name: "New York Knicks",
      record: "50-32",
      identity: "Paint pressure and offensive rebounding",
    },
    pillars: [
      {
        id: "shot-profile",
        label: "Shot Profile",
        awayValue: "39% of attempts from 3",
        homeValue: "Top-10 at limiting rim volume",
        edge: "away",
        takeaway: "Boston creates cleaner perimeter math.",
        whyItMatters: "If Boston gets its normal pull-up and pick-and-pop diet, New York has to score through a harder shot mix.",
      },
      {
        id: "glass",
        label: "Offensive Glass",
        awayValue: "74% defensive rebound rate",
        homeValue: "31% offensive rebound rate",
        edge: "home",
        takeaway: "New York can steal possessions after initial misses.",
        whyItMatters: "Second-chance points are the cleanest way for the Knicks to offset Boston's shot-quality edge.",
      },
      {
        id: "turnovers",
        label: "Turnover Battle",
        awayValue: "11.8% turnover rate",
        homeValue: "Few live-ball takeaways",
        edge: "away",
        takeaway: "Boston usually gets to its shot without wasting trips.",
        whyItMatters: "Possession discipline matters because New York wants a longer, more physical game.",
      },
    ],
    swingFactor: {
      title: "Knicks second-shot pressure",
      summary: "If New York turns missed first shots into put-backs and kick-out 3s, it changes the possession count and lowers Boston's spacing edge.",
    },
    teachingPoints: [
      "A matchup edge is often about possession type, not just better overall talent.",
      "Rebounding and turnover control can narrow a shot-quality gap without changing the stars on the floor.",
    ],
  },
  {
    id: "okc-at-den",
    label: "Thunder at Nuggets",
    matchup: "Oklahoma City Thunder at Denver Nuggets",
    context: "Demo scouting board for rim pressure versus half-court decision making.",
    beginnerSummary:
      "Oklahoma City wants downhill speed and paint touches. Denver prefers a calmer half-court game where every cut and screen has a purpose.",
    advancedSummary:
      "OKC's pressure comes from drives, kick-outs, and turnover creation. Denver answers with deliberate half-court creation and elite passing from the middle of the floor.",
    away: {
      key: "OKC",
      name: "Oklahoma City Thunder",
      record: "57-25",
      identity: "Drive-and-kick pressure with active hands",
    },
    home: {
      key: "DEN",
      name: "Denver Nuggets",
      record: "54-28",
      identity: "Jokic-centered half-court creation",
    },
    pillars: [
      {
        id: "paint-pressure",
        label: "Paint Touches",
        awayValue: "High drive frequency",
        homeValue: "Protects the nail with size",
        edge: "away",
        takeaway: "OKC puts more defenders in rotation.",
        whyItMatters: "The Thunder gain their edge when the first line of defense gets moved and the weak side has to help.",
      },
      {
        id: "half-court",
        label: "Half-Court Efficiency",
        awayValue: "Wins with pace and pressure",
        homeValue: "Elite cutter and hub offense",
        edge: "home",
        takeaway: "Denver is more comfortable when the game slows down.",
        whyItMatters: "Late-clock possessions often decide playoff-style matchups, and Denver is built to survive them.",
      },
      {
        id: "turnover-pressure",
        label: "Turnover Pressure",
        awayValue: "Active deflections and digs",
        homeValue: "Protects the ball through the hub",
        edge: "even",
        takeaway: "The possession battle may stay close.",
        whyItMatters: "If Denver handles OKC's hands without coughing up live-ball turnovers, it can flatten one of the Thunder's easiest scoring paths.",
      },
    ],
    swingFactor: {
      title: "Can Denver keep the game in the half court?",
      summary: "If Denver cuts off the Thunder's transition offense, OKC has to win more often against a set defense.",
    },
    teachingPoints: [
      "Transition pressure and half-court precision are different kinds of offensive strength.",
      "A matchup profile should show how style collisions create or remove easy shots.",
    ],
  },
  {
    id: "dal-at-min",
    label: "Mavericks at Timberwolves",
    matchup: "Dallas Mavericks at Minnesota Timberwolves",
    context: "Demo scouting board for pick-and-roll creation versus size and rim deterrence.",
    beginnerSummary:
      "Dallas leans on creator-driven pick-and-rolls. Minnesota tries to turn those actions into long jumpers and late-clock decisions.",
    advancedSummary:
      "Dallas can still create efficient shots when the first action is covered, but Minnesota's size shrinks the rim and tests every secondary read.",
    away: {
      key: "DAL",
      name: "Dallas Mavericks",
      record: "49-33",
      identity: "Creator-heavy pick-and-roll offense",
    },
    home: {
      key: "MIN",
      name: "Minnesota Timberwolves",
      record: "52-30",
      identity: "Length, size, and rim deterrence",
    },
    pillars: [
      {
        id: "pick-roll",
        label: "Pick-and-Roll Control",
        awayValue: "High-volume advantage creation",
        homeValue: "Length at the point of attack",
        edge: "away",
        takeaway: "Dallas can still manufacture the first advantage.",
        whyItMatters: "If Dallas consistently gets two defenders on the ball, the rest of the floor starts tilting.",
      },
      {
        id: "rim-deterrence",
        label: "Rim Deterrence",
        awayValue: "Relies on pocket passes and floaters",
        homeValue: "Top-tier paint size",
        edge: "home",
        takeaway: "Minnesota makes clean rim looks hard to find.",
        whyItMatters: "Forcing late floaters and bailout jumpers is a major win for the Wolves defense.",
      },
      {
        id: "bench-scoring",
        label: "Bench Scoring",
        awayValue: "Shot creation dips without stars",
        homeValue: "Reserve units keep size and pace",
        edge: "home",
        takeaway: "Minnesota's non-star minutes are less fragile.",
        whyItMatters: "Depth pressure matters when the main creators sit and the offense has to survive a different shape of game.",
      },
    ],
    swingFactor: {
      title: "Secondary playmaking after the first trap",
      summary: "Minnesota can live with tough primary shots. The bigger question is whether Dallas keeps generating quality looks after the first read is taken away.",
    },
    teachingPoints: [
      "A strong creator does not erase matchup context; it changes which counters the defense has to show.",
      "Bench minutes matter because role players often decide whether a star-driven edge actually lasts for 48 minutes.",
    ],
  },
];

const REST_SCENARIOS: NbaRestScheduleSpotRaw[] = [
  {
    id: "min-rest-edge",
    label: "Timberwolves rest edge",
    team: {
      key: "MIN",
      name: "Minnesota Timberwolves",
      record: "52-30",
    },
    opponent: {
      key: "PHX",
      name: "Phoenix Suns",
      record: "46-36",
    },
    spotLabel: "Rest edge",
    signal: "positive",
    context: "Demo schedule spot for rest advantage plus a softer travel load.",
    beginnerSummary:
      "Minnesota has fresher legs and a cleaner travel setup than Phoenix, which usually matters most on defense and on late-clock possessions.",
    advancedSummary:
      "The Wolves are coming off two days of rest and stay at home. Phoenix is on the second night of a back-to-back after travel, so the schedule spot tilts toward Minnesota before talent even enters the conversation.",
    factors: [
      {
        label: "Rest days",
        teamValue: "2 days off",
        opponentValue: "0 days off",
        edge: "team",
        takeaway: "Fresh legs favor Minnesota.",
        whyItMatters: "Rest edges often show up first in defensive rotations, rim contests, and late-game shot quality.",
      },
      {
        label: "Travel load",
        teamValue: "Stayed home",
        opponentValue: "Late arrival from road game",
        edge: "team",
        takeaway: "Phoenix gets less recovery time.",
        whyItMatters: "Travel stress compounds fatigue because the team loses recovery windows even if the minutes look manageable.",
      },
      {
        label: "Starter strain",
        teamValue: "Normal workload",
        opponentValue: "Lead guard played 39 minutes",
        edge: "team",
        takeaway: "High-minute stars feel the schedule first.",
        whyItMatters: "Schedule spots matter more when the ball-dominant players already carried a heavy load in the previous game.",
      },
    ],
    recentWindow: [
      { dateLabel: "Tue", site: "vs", opponent: "UTA", result: "W 118-104", note: "Two days off before this game." },
      { dateLabel: "Fri", site: "vs", opponent: "MEM", result: "W 112-107", note: "Home stand continues." },
      { dateLabel: "Sun", site: "vs", opponent: "PHX", note: "Featured rest-edge spot." },
    ],
    nextWindow: [
      { dateLabel: "Tue", site: "@", opponent: "DEN", note: "Single travel day after this spot." },
      { dateLabel: "Thu", site: "vs", opponent: "LAC", note: "Returns home with normal rest." },
    ],
    teachingPoints: [
      "Rest edges are strongest when they combine with travel and short recovery windows.",
      "Do not treat every back-to-back the same; the surrounding minutes and travel shape the real stress.",
    ],
  },
  {
    id: "gsw-third-in-four",
    label: "Warriors 3-in-4 warning",
    team: {
      key: "GSW",
      name: "Golden State Warriors",
      record: "47-35",
    },
    opponent: {
      key: "SAC",
      name: "Sacramento Kings",
      record: "45-37",
    },
    spotLabel: "3 in 4 nights",
    signal: "warning",
    context: "Demo schedule spot for compressed game density and travel.",
    beginnerSummary:
      "Golden State is playing its third game in four nights, which usually shows up in jumper legs, transition defense, and bench reliance.",
    advancedSummary:
      "This is the classic warning spot: game density is high, travel is layered in, and the opponent is at home on normal rest. The risk is not just tired stars; it is a thinner margin for every rotation decision.",
    factors: [
      {
        label: "Game density",
        teamValue: "Third game in 4 nights",
        opponentValue: "One game in 3 nights",
        edge: "opponent",
        takeaway: "The Kings have the fresher rotation.",
        whyItMatters: "Compressed schedules reduce practice, treatment, and recovery time all at once.",
      },
      {
        label: "Travel path",
        teamValue: "Road-road travel",
        opponentValue: "Stayed home",
        edge: "opponent",
        takeaway: "Golden State loses recovery time to travel.",
        whyItMatters: "The hardest part of travel is often the lost routine around sleep and treatment, not just miles flown.",
      },
      {
        label: "Bench dependence",
        teamValue: "Second unit needed to bridge starter minutes",
        opponentValue: "Cleaner starter rest pattern",
        edge: "opponent",
        takeaway: "Golden State may need more non-primary creation.",
        whyItMatters: "When legs go first, coaches lean on role players to protect star minutes, which can change the shot diet.",
      },
    ],
    recentWindow: [
      { dateLabel: "Thu", site: "vs", opponent: "POR", result: "W 123-109", note: "Home opener for the stretch." },
      { dateLabel: "Fri", site: "@", opponent: "LAL", result: "L 116-120", note: "Travel overnight." },
      { dateLabel: "Sun", site: "@", opponent: "SAC", note: "Third game in four nights." },
    ],
    nextWindow: [
      { dateLabel: "Wed", site: "vs", opponent: "NOP", note: "Finally returns home with two days off." },
      { dateLabel: "Fri", site: "vs", opponent: "UTA", note: "Cleaner rotation spot." },
    ],
    teachingPoints: [
      "Schedule stress changes lineup trust and substitution patterns, not just shooting percentages.",
      "A warning spot does not predict a loss by itself; it tells you where the hidden fragility may show up.",
    ],
  },
  {
    id: "cle-neutral",
    label: "Cavaliers neutral spot",
    team: {
      key: "CLE",
      name: "Cleveland Cavaliers",
      record: "51-31",
    },
    opponent: {
      key: "ORL",
      name: "Orlando Magic",
      record: "44-38",
    },
    spotLabel: "Neutral rest",
    signal: "neutral",
    context: "Demo schedule spot where neither side owns a clear rest edge.",
    beginnerSummary:
      "This is a more neutral schedule spot, so the matchup should be driven more by style and execution than by hidden fatigue advantages.",
    advancedSummary:
      "Both teams have similar rest and manageable travel. That does not remove schedule context entirely, but it lowers the odds that fatigue is the main explanation for the result.",
    factors: [
      {
        label: "Rest days",
        teamValue: "1 day off",
        opponentValue: "1 day off",
        edge: "even",
        takeaway: "Neither side owns the easy fatigue edge.",
        whyItMatters: "Neutral spots are useful because they shift the evaluation back toward style, talent, and execution.",
      },
      {
        label: "Travel load",
        teamValue: "Single flight with recovery day",
        opponentValue: "Single flight with recovery day",
        edge: "even",
        takeaway: "Travel should not dominate the story.",
        whyItMatters: "If travel is equal, it should not become the default explanation for a bad shooting night.",
      },
      {
        label: "Rotation strain",
        teamValue: "Starter minutes stable",
        opponentValue: "Starter minutes stable",
        edge: "even",
        takeaway: "Expect more normal substitution patterns.",
        whyItMatters: "Neutral spots make it easier to isolate true matchup wins from schedule-driven noise.",
      },
    ],
    recentWindow: [
      { dateLabel: "Wed", site: "@", opponent: "CHI", result: "W 108-101", note: "Normal travel day." },
      { dateLabel: "Fri", site: "vs", opponent: "ORL", note: "Featured neutral spot." },
    ],
    nextWindow: [
      { dateLabel: "Sun", site: "@", opponent: "IND", note: "Another normal-rest game." },
      { dateLabel: "Tue", site: "vs", opponent: "MIA", note: "Schedule remains balanced." },
    ],
    teachingPoints: [
      "Neutral schedule spots are useful baselines because they reduce the temptation to over-explain results with fatigue.",
      "Not every pregame edge has to come from rest; sometimes the best answer is that the schedule is mostly neutral.",
    ],
  },
];

const PLAYER_ROLE_SCENARIOS: NbaPlayerRoleFormRaw[] = [
  {
    id: "brunson-lead-guard",
    label: "Jalen Brunson lead guard",
    player: {
      fullName: "Jalen Brunson",
      teamKey: "NYK",
      teamName: "New York Knicks",
      position: "PG",
      role: "Lead guard",
      archetype: "High-usage creator and late-clock closer",
    },
    form: "hot",
    context: "Demo player card for on-ball role, usage lift, and recent scoring form.",
    beginnerSummary:
      "Brunson's role is easy to read: he controls possessions late, creates his own shot, and his recent form shows more of the offense running through him.",
    advancedSummary:
      "The role signal is not just points. Brunson's usage, free-throw pressure, and late-clock creation are all trending up, which means the box score is being driven by more on-ball responsibility rather than random shooting noise.",
    metrics: [
      {
        label: "Usage share",
        seasonValue: "30%",
        recentValue: "33%",
        trend: "up",
        takeaway: "More possessions are ending with Brunson's decision.",
      },
      {
        label: "Paint touches",
        seasonValue: "14.2",
        recentValue: "16.0",
        trend: "up",
        takeaway: "He is getting to his scoring zones more often.",
      },
      {
        label: "Assist rate",
        seasonValue: "34%",
        recentValue: "37%",
        trend: "up",
        takeaway: "The playmaking load is rising along with the scoring load.",
      },
    ],
    roleSignals: [
      {
        label: "Closing role",
        value: "Primary late-clock creator",
        explanation: "The offense is comfortable ending possessions with Brunson against a set defense.",
      },
      {
        label: "Shot diet",
        value: "Pull-up midrange plus paint touch creation",
        explanation: "His value comes from creating shots the defense cannot fully take away, not just catch-and-shoot volume.",
      },
      {
        label: "Foul pressure",
        value: "High free-throw pressure",
        explanation: "Free throws stabilize scoring because they do not depend on volatile jump shooting alone.",
      },
    ],
    recentGames: [
      {
        dateLabel: "Mar 8",
        opponent: "MIA",
        line: "31 PTS, 8 AST, 6 FTA",
        roleNote: "Closed the final six possessions as the primary handler.",
      },
      {
        dateLabel: "Mar 6",
        opponent: "PHI",
        line: "27 PTS, 9 AST, 15 paint touches",
        roleNote: "Used to settle the offense whenever New York's spacing tightened.",
      },
      {
        dateLabel: "Mar 4",
        opponent: "BOS",
        line: "34 PTS, 7 AST, 11-21 FG",
        roleNote: "Created enough late-clock offense to keep the game from stalling.",
      },
    ],
    teachingPoints: [
      "Role explains where stats come from. Usage lifts are more trustworthy when they match closing duties and touch volume.",
      "Recent scoring is more meaningful when it is paired with the same role signals that created the season baseline.",
    ],
  },
  {
    id: "derrick-white-connector",
    label: "Derrick White connector",
    player: {
      fullName: "Derrick White",
      teamKey: "BOS",
      teamName: "Boston Celtics",
      position: "G",
      role: "Connector guard",
      archetype: "Two-way spacer, secondary creator, and rotation stabilizer",
    },
    form: "steady",
    context: "Demo player card for low-maintenance creation and role stability.",
    beginnerSummary:
      "White is valuable because he does a little of everything without needing the offense to be built around him.",
    advancedSummary:
      "This is a classic connector profile. White's value comes from keeping the offense organized, spacing the floor, and adding secondary playmaking without hijacking usage from the stars.",
    metrics: [
      {
        label: "Usage share",
        seasonValue: "19%",
        recentValue: "20%",
        trend: "steady",
        takeaway: "The role is stable rather than expanding.",
      },
      {
        label: "Catch-and-shoot 3PA",
        seasonValue: "6.1",
        recentValue: "6.4",
        trend: "steady",
        takeaway: "Spacing remains the baseline skill.",
      },
      {
        label: "Secondary assists",
        seasonValue: "2.4",
        recentValue: "2.9",
        trend: "up",
        takeaway: "He helps keep the ball moving to the next advantage.",
      },
    ],
    roleSignals: [
      {
        label: "Shot diet",
        value: "Mostly catch-and-shoot plus quick second-side drives",
        explanation: "That shot mix keeps his efficiency more stable than a pure self-creation role.",
      },
      {
        label: "Lineup fit",
        value: "Scales up or down next to stars",
        explanation: "Connector guards are valuable because they can keep the structure intact without dominating the ball.",
      },
      {
        label: "Defensive load",
        value: "Point-of-attack minutes",
        explanation: "Two-way role stability matters because heavy defensive assignments can change offensive volume if the player is overextended.",
      },
    ],
    recentGames: [
      {
        dateLabel: "Mar 8",
        opponent: "TOR",
        line: "17 PTS, 6 AST, 4 3PM",
        roleNote: "Played the organizer role when the second unit opened the fourth.",
      },
      {
        dateLabel: "Mar 6",
        opponent: "CLE",
        line: "14 PTS, 5 AST, 2 STL",
        roleNote: "Balanced spacing with defensive point-of-attack work.",
      },
      {
        dateLabel: "Mar 4",
        opponent: "MIL",
        line: "19 PTS, 4 AST, 3 BLK",
        roleNote: "Produced without needing extra usage.",
      },
    ],
    teachingPoints: [
      "Not every useful player profile is about star volume. Connector roles explain why a player can matter without a huge box score.",
      "Stable role plus stable shot diet is often more predictive than a short burst of scoring alone.",
    ],
  },
  {
    id: "naz-reid-bench-scorer",
    label: "Naz Reid bench scorer",
    player: {
      fullName: "Naz Reid",
      teamKey: "MIN",
      teamName: "Minnesota Timberwolves",
      position: "F/C",
      role: "Bench scorer",
      archetype: "Frontcourt microwave who can close when the matchup fits",
    },
    form: "cool",
    context: "Demo player card for bench role volatility and matchup-dependent closing minutes.",
    beginnerSummary:
      "Reid can score quickly, but bench roles swing more from matchup to matchup, so recent production is less stable than a star's production.",
    advancedSummary:
      "Bench scorers are useful to study because role volatility is part of the profile. Reid's usage is strong when he is on the floor, but his minute ceiling and closing role can still change based on the opponent's size and spacing.",
    metrics: [
      {
        label: "Bench usage",
        seasonValue: "25%",
        recentValue: "23%",
        trend: "down",
        takeaway: "The scoring load is still real, but the recent usage spike cooled off.",
      },
      {
        label: "Minutes",
        seasonValue: "26.1",
        recentValue: "22.8",
        trend: "down",
        takeaway: "Playing time is the biggest swing variable.",
      },
      {
        label: "3PA volume",
        seasonValue: "5.3",
        recentValue: "4.7",
        trend: "down",
        takeaway: "Fewer frontcourt jumpers lowers the ceiling.",
      },
    ],
    roleSignals: [
      {
        label: "Closing role",
        value: "Matchup dependent",
        explanation: "He closes more often when the opposing frontcourt cannot punish smaller lineups on the other end.",
      },
      {
        label: "Scoring source",
        value: "Bench shot creation plus pop spacing",
        explanation: "His profile mixes self-created second-unit scoring with floor spacing from the frontcourt.",
      },
      {
        label: "Minute volatility",
        value: "Higher than a starter",
        explanation: "Bench roles can look strong on a per-minute basis while still staying fragile because the minutes are not guaranteed.",
      },
    ],
    recentGames: [
      {
        dateLabel: "Mar 8",
        opponent: "PHX",
        line: "14 PTS, 5 REB, 2 3PM",
        roleNote: "Scored in the second unit but did not close.",
      },
      {
        dateLabel: "Mar 6",
        opponent: "MEM",
        line: "11 PTS, 4 REB, 21 MIN",
        roleNote: "Minutes dipped once Minnesota went back to a bigger defensive group.",
      },
      {
        dateLabel: "Mar 4",
        opponent: "UTA",
        line: "20 PTS, 6 REB, 3 3PM",
        roleNote: "Closed because Utah could not punish the spacing lineup.",
      },
    ],
    teachingPoints: [
      "Bench scorers teach an important lesson: per-minute production is not the same as stable volume.",
      "Role volatility should change how confident you are in short-term form spikes.",
    ],
  },
];

export function getNbaTeamMatchupProfileDemo(
  scenarioId: string | undefined,
  dataMode: DemoDataMode,
): { data: TeamMatchupDemoData; meta: Meta } {
  const { selected, warning } = resolveScenario(TEAM_MATCHUP_SCENARIOS, scenarioId);
  return {
    data: {
      ...selected,
      selectedScenarioId: selected.id,
      availableScenarios: scenarioOptions(TEAM_MATCHUP_SCENARIOS),
      sourceLabel: "Demo scouting scenario",
    },
    meta: buildMeta(dataMode, "Team matchup profile is currently using curated NBA demo scenarios.", warning),
  };
}

export function getNbaRestScheduleSpotDemo(
  scenarioId: string | undefined,
  dataMode: DemoDataMode,
): { data: RestScheduleDemoData; meta: Meta } {
  const { selected, warning } = resolveScenario(REST_SCENARIOS, scenarioId);
  return {
    data: {
      ...selected,
      selectedScenarioId: selected.id,
      availableScenarios: scenarioOptions(REST_SCENARIOS),
      sourceLabel: "Demo schedule scenario",
    },
    meta: buildMeta(dataMode, "Rest / schedule spot is currently using curated NBA demo scenarios.", warning),
  };
}

export function getNbaPlayerRoleFormDemo(
  scenarioId: string | undefined,
  dataMode: DemoDataMode,
): { data: PlayerRoleFormDemoData; meta: Meta } {
  const { selected, warning } = resolveScenario(PLAYER_ROLE_SCENARIOS, scenarioId);
  return {
    data: {
      ...selected,
      selectedScenarioId: selected.id,
      availableScenarios: scenarioOptions(PLAYER_ROLE_SCENARIOS),
      sourceLabel: "Demo player role scenario",
    },
    meta: buildMeta(dataMode, "Player role + form is currently using curated NBA demo scenarios.", warning),
  };
}
