export type GlossarySport = "ALL" | "NFL" | "NBA" | "MLB" | "UTILITIES";

export type GlossaryTerm = {
  sport: GlossarySport;
  key: string;
  label: string;
  plainDefinition: string;
  whyItMatters: string;
  advancedNotes?: string;
  learnMoreUrl?: string;
  aliases?: string[];
};

type GlossaryLookup = {
  key?: string | null;
  label?: string | null;
  sport?: string | null;
};

type RawGlossaryTerm = Partial<GlossaryTerm> & {
  sport?: unknown;
  key?: unknown;
  label?: unknown;
  plainDefinition?: unknown;
  whyItMatters?: unknown;
  advancedNotes?: unknown;
  learnMoreUrl?: unknown;
  aliases?: unknown;
};

function term(definition: GlossaryTerm): GlossaryTerm {
  return definition;
}

export const BUILTIN_GLOSSARY_TERMS: GlossaryTerm[] = [
  term({
    sport: "MLB",
    key: "games_played",
    label: "G",
    aliases: ["games", "games played"],
    plainDefinition: "Games played is the number of games in which a player appeared.",
    whyItMatters: "It provides workload context so rate stats and counting totals are easier to judge.",
    advancedNotes: "Use it with plate appearances or innings pitched before drawing strong conclusions from small samples.",
  }),
  term({
    sport: "MLB",
    key: "avg",
    label: "AVG",
    aliases: ["batting average", "team avg"],
    plainDefinition: "Batting average is hits divided by at-bats.",
    whyItMatters: "It gives a quick read on how often a hitter or lineup records a hit.",
    advancedNotes: "AVG ignores walks and power, so it is best paired with OBP and SLG.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/batting-average",
  }),
  term({
    sport: "MLB",
    key: "obp",
    label: "OBP",
    aliases: ["on-base percentage", "team obp"],
    plainDefinition: "On-base percentage measures how often a hitter reaches base by hit, walk, or hit-by-pitch.",
    whyItMatters: "Getting on base is the foundation of run scoring, so OBP is often more useful than AVG alone.",
    advancedNotes: "OBP captures patience and contact quality better than AVG because it rewards walks.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/on-base-percentage",
  }),
  term({
    sport: "MLB",
    key: "slg",
    label: "SLG",
    aliases: ["slugging", "slugging percentage", "team slg"],
    plainDefinition: "Slugging percentage measures total bases per at-bat.",
    whyItMatters: "It highlights extra-base power that simple hit totals can miss.",
    advancedNotes: "SLG is a power stat; pair it with OBP for a fuller view of overall offensive value.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/slugging-percentage",
  }),
  term({
    sport: "MLB",
    key: "ops",
    label: "OPS",
    aliases: ["on-base plus slugging"],
    plainDefinition: "OPS adds on-base percentage and slugging percentage together.",
    whyItMatters: "It combines getting on base and hitting for power into one quick offensive snapshot.",
    advancedNotes: "OPS is widely used, but it weights OBP and SLG equally even though they do not contribute equally to run scoring.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/on-base-plus-slugging",
  }),
  term({
    sport: "MLB",
    key: "hr",
    label: "HR",
    aliases: ["home runs"],
    plainDefinition: "Home runs count balls hit fair over the outfield fence or inside-the-park homers.",
    whyItMatters: "Home runs create instant scoring and are one of the fastest ways to change a game.",
  }),
  term({
    sport: "MLB",
    key: "rbi",
    label: "RBI",
    aliases: ["runs batted in"],
    plainDefinition: "Runs batted in count how many runs score because of a hitter's plate appearance, with a few scoring-rule exceptions.",
    whyItMatters: "RBI captures run production, especially in spots with runners on base.",
    advancedNotes: "RBI depends heavily on lineup context, so it should not be treated as a pure skill stat.",
  }),
  term({
    sport: "MLB",
    key: "walks",
    label: "BB",
    aliases: ["base on balls", "walks"],
    plainDefinition: "Walks are plate appearances that end with four balls and award first base.",
    whyItMatters: "They raise OBP and often signal plate discipline.",
  }),
  term({
    sport: "MLB",
    key: "strikeouts",
    label: "K",
    aliases: ["so", "strikeouts", "strike outs"],
    plainDefinition: "Strikeouts are plate appearances or batters retired with three strikes.",
    whyItMatters: "For hitters, fewer strikeouts can mean more balls in play. For pitchers, more strikeouts reduce reliance on defense.",
  }),
  term({
    sport: "MLB",
    key: "earned_runs",
    label: "ER",
    aliases: ["earned runs"],
    plainDefinition: "Earned runs are runs charged to a pitcher that score without the help of fielding errors or passed balls.",
    whyItMatters: "They are the raw input behind ERA and help explain how much damage happened in a specific outing.",
  }),
  term({
    sport: "MLB",
    key: "stolen_bases",
    label: "SB",
    aliases: ["steals", "stolen bases"],
    plainDefinition: "Stolen bases count successful advances to the next base while the ball is live and not put in play.",
    whyItMatters: "They add value on the bases and can quickly turn singles into scoring opportunities.",
  }),
  term({
    sport: "MLB",
    key: "era",
    label: "ERA",
    aliases: ["earned run average", "starters era", "bullpen era"],
    plainDefinition: "Earned run average is earned runs allowed per nine innings pitched.",
    whyItMatters: "It is the most familiar quick summary of run prevention for pitchers and staffs.",
    advancedNotes: "ERA is affected by defense, sequencing, and official scoring, so it should be paired with WHIP and strikeout rates.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/earned-run-average",
  }),
  term({
    sport: "MLB",
    key: "whip",
    label: "WHIP",
    aliases: ["walks plus hits per inning pitched"],
    plainDefinition: "WHIP measures walks plus hits allowed per inning pitched.",
    whyItMatters: "It shows how often a pitcher allows traffic on the bases.",
    advancedNotes: "Lower WHIP usually means fewer scoring chances created for the opponent.",
    learnMoreUrl: "https://www.mlb.com/glossary/advanced-stats/walks-and-hits-per-inning-pitched",
  }),
  term({
    sport: "MLB",
    key: "innings_pitched",
    label: "IP",
    aliases: ["innings pitched", "inningspitched"],
    plainDefinition: "Innings pitched shows how many outs a pitcher recorded, expressed in innings.",
    whyItMatters: "It gives workload and sample-size context for ERA, WHIP, and strikeout stats.",
  }),
  term({
    sport: "MLB",
    key: "wins",
    label: "W",
    aliases: ["wins"],
    plainDefinition: "Pitcher wins credit the pitcher of record when his team takes the lead for good.",
    whyItMatters: "Wins are a familiar result stat, but they also depend heavily on team offense and bullpen support.",
  }),
  term({
    sport: "MLB",
    key: "losses",
    label: "L",
    aliases: ["losses"],
    plainDefinition: "Pitcher losses are charged when a pitcher is responsible for the lead that the opponent never gives back.",
    whyItMatters: "Like wins, losses are outcome-based and often reflect team context as much as pitcher skill.",
  }),
  term({
    sport: "ALL",
    key: "w_l_record",
    label: "W-L",
    aliases: ["record", "win loss record"],
    plainDefinition: "W-L shows wins and losses together as a record line.",
    whyItMatters: "It gives a fast summary of results, especially for pitchers, teams, or standings tables.",
  }),
  term({
    sport: "MLB",
    key: "games_started",
    label: "GS",
    aliases: ["games started"],
    plainDefinition: "Games started count how many times a pitcher or player was in the starting lineup.",
    whyItMatters: "It separates rotation workload from relief work and helps explain sample size.",
  }),
  term({
    sport: "MLB",
    key: "opponent_avg",
    label: "Opp AVG",
    aliases: ["opponent batting average", "opponentavg"],
    plainDefinition: "Opponent batting average shows how often hitters get hits against a pitcher.",
    whyItMatters: "It is a simple way to judge how difficult a pitcher has been to square up.",
  }),
  term({
    sport: "MLB",
    key: "k_per_9",
    label: "K/9",
    aliases: ["k9", "kper9", "strikeouts per nine"],
    plainDefinition: "K/9 estimates how many strikeouts a pitcher records every nine innings.",
    whyItMatters: "Higher strikeout rates usually mean less dependence on defense and more direct run prevention skill.",
  }),
  term({
    sport: "MLB",
    key: "bb_per_9",
    label: "BB/9",
    aliases: ["bb9", "bbper9", "walks per nine"],
    plainDefinition: "BB/9 estimates how many walks a pitcher allows every nine innings.",
    whyItMatters: "Lower walk rates usually mean better command and fewer free baserunners.",
  }),
  term({
    sport: "MLB",
    key: "hr_per_9",
    label: "HR/9",
    aliases: ["hr9", "hrper9", "home runs per nine"],
    plainDefinition: "HR/9 estimates how many home runs a pitcher allows every nine innings.",
    whyItMatters: "Home-run suppression matters because homers create immediate damage.",
  }),
  term({
    sport: "ALL",
    key: "win_pct",
    label: "Pct",
    aliases: ["winning percentage", "win%", "win pct"],
    plainDefinition: "Winning percentage is wins divided by total decisions or games played.",
    whyItMatters: "It normalizes record so teams or players with different game totals are easier to compare.",
  }),
  term({
    sport: "MLB",
    key: "games_back",
    label: "GB",
    aliases: ["games back"],
    plainDefinition: "Games back shows how far a team trails the division or conference leader in the standings.",
    whyItMatters: "It gives fast context for where a team sits in the race.",
  }),
  term({
    sport: "MLB",
    key: "runs_scored",
    label: "Runs",
    aliases: ["runs scored"],
    plainDefinition: "Runs scored are the total runs a hitter, lineup, or team has produced.",
    whyItMatters: "Scoring is the direct offensive objective, so runs provide bottom-line production context.",
  }),
  term({
    sport: "MLB",
    key: "runs_allowed",
    label: "RA",
    aliases: ["runs allowed"],
    plainDefinition: "Runs allowed are the total runs a team or pitching staff has given up.",
    whyItMatters: "It is a direct team-level measure of run prevention.",
  }),
  term({
    sport: "MLB",
    key: "saves",
    label: "Saves",
    aliases: ["save"],
    plainDefinition: "Saves credit relievers who finish certain close wins while preserving the lead.",
    whyItMatters: "They describe bullpen conversion in traditional late-game situations.",
  }),
  term({
    sport: "MLB",
    key: "blown_saves",
    label: "BS",
    aliases: ["blown saves", "blown save"],
    plainDefinition: "Blown saves count save opportunities that a reliever fails to convert.",
    whyItMatters: "They add context to bullpen reliability in leverage spots.",
  }),
  term({
    sport: "MLB",
    key: "batters_faced",
    label: "BF",
    aliases: ["batters faced"],
    plainDefinition: "Batters faced count how many hitters a pitcher has seen.",
    whyItMatters: "It helps frame whether split lines come from meaningful sample size or very small usage.",
  }),
  term({
    sport: "MLB",
    key: "run_differential",
    label: "Run Differential",
    aliases: ["run diff"],
    plainDefinition: "Run differential is runs scored minus runs allowed.",
    whyItMatters: "Over time it is often more predictive of team quality than raw win-loss record.",
  }),
  term({
    sport: "MLB",
    key: "weighted_win_pct",
    label: "Weighted Win%",
    aliases: ["weighted win pct", "weighted winning percentage"],
    plainDefinition: "Weighted win percentage blends performance across multiple recent windows instead of using only one stretch.",
    whyItMatters: "It smooths noise while still rewarding the freshest results more heavily than older ones.",
  }),
  term({
    sport: "MLB",
    key: "run_diff_per_game",
    label: "R/G Diff",
    aliases: ["run differential per game", "runs per game differential"],
    plainDefinition: "Run differential per game is average runs scored minus average runs allowed over the selected sample.",
    whyItMatters: "It shows whether a team is merely winning games or actually controlling them.",
  }),
  term({
    sport: "MLB",
    key: "days_rest",
    label: "Rest",
    aliases: ["days rest"],
    plainDefinition: "Days rest count how many days have passed since a pitcher's last outing.",
    whyItMatters: "Rest is a quick proxy for freshness, availability, and likely workload tolerance.",
  }),
  term({
    sport: "MLB",
    key: "pitches_strikes",
    label: "P/S",
    aliases: ["pitches strikes", "pitches/strikes"],
    plainDefinition: "P/S shows total pitches thrown and how many of them were strikes.",
    whyItMatters: "It combines workload with basic command information in one compact line.",
  }),
  term({
    sport: "MLB",
    key: "re24",
    label: "RE24",
    aliases: ["run expectancy"],
    plainDefinition: "RE24 is the average number of runs teams score from a specific base-out state until the inning ends.",
    whyItMatters: "It turns every base and out situation into a concrete run-scoring expectation.",
    advancedNotes: "The same baserunners can have very different value depending on outs, which is why RE24 is useful for strategy and context.",
    learnMoreUrl: "https://www.mlb.com/glossary/advanced-stats/re24",
  }),
  term({
    sport: "MLB",
    key: "score_probability",
    label: "Probability of scoring",
    aliases: ["score pct", "scoring probability"],
    plainDefinition: "Probability of scoring is the chance that at least one run will score from the current base-out state before the inning ends.",
    whyItMatters: "It explains how threatening a situation is even when expected runs look similar.",
  }),
  term({
    sport: "MLB",
    key: "delta_vs_baseline",
    label: "Delta vs baseline",
    aliases: ["delta versus baseline"],
    plainDefinition: "Delta vs baseline is the difference between the selected situation and a reference state, usually bases empty with no outs.",
    whyItMatters: "It shows how much extra run value a state gains or loses compared with a neutral inning start.",
  }),
  term({
    sport: "NBA",
    key: "ppg",
    label: "PPG",
    aliases: ["points per game"],
    plainDefinition: "Points per game is average points scored each game.",
    whyItMatters: "It is the fastest summary of scoring volume.",
  }),
  term({
    sport: "NBA",
    key: "rpg",
    label: "RPG",
    aliases: ["rebounds per game"],
    plainDefinition: "Rebounds per game is average rebounds each game.",
    whyItMatters: "It tracks how often a player ends possessions or extends them with offensive boards.",
  }),
  term({
    sport: "NBA",
    key: "apg",
    label: "APG",
    aliases: ["assists per game"],
    plainDefinition: "Assists per game is average assists each game.",
    whyItMatters: "It is a quick signal of playmaking responsibility and creation volume.",
  }),
  term({
    sport: "NBA",
    key: "ts",
    label: "TS%",
    aliases: ["true shooting", "true shooting percentage"],
    plainDefinition: "True shooting percentage estimates scoring efficiency by combining twos, threes, and free throws.",
    whyItMatters: "It is one of the cleanest all-in-one scoring efficiency metrics in basketball.",
    learnMoreUrl: "https://www.nba.com/stats/help/glossary",
  }),
  term({
    sport: "NFL",
    key: "pass_yds",
    label: "Pass YDS",
    aliases: ["passing yards"],
    plainDefinition: "Passing yards are total yards gained through completed passes.",
    whyItMatters: "They summarize quarterback and passing-game volume.",
  }),
  term({
    sport: "NFL",
    key: "pass_ypg",
    label: "Pass YPG",
    aliases: ["passing yards per game"],
    plainDefinition: "Passing yards per game is average passing yards each game.",
    whyItMatters: "It normalizes production across players with different game totals.",
  }),
  term({
    sport: "NFL",
    key: "pass_td",
    label: "Pass TD",
    aliases: ["passing touchdowns"],
    plainDefinition: "Pass TD counts touchdown passes thrown by a quarterback.",
    whyItMatters: "Touchdown creation is a direct measure of passing-game scoring impact.",
  }),
  term({
    sport: "NFL",
    key: "pass_tdpg",
    label: "Pass TD/G",
    aliases: ["passing touchdowns per game"],
    plainDefinition: "Pass TD per game is average touchdown passes thrown each game.",
    whyItMatters: "It compares scoring production on a per-game basis instead of raw season totals.",
  }),
  term({
    sport: "NFL",
    key: "int",
    label: "INT",
    aliases: ["interceptions"],
    plainDefinition: "Interceptions are passes caught by the defense.",
    whyItMatters: "They are one of the most costly passing mistakes because they end drives and often flip field position.",
  }),
  term({
    sport: "NFL",
    key: "intpg",
    label: "INT/G",
    aliases: ["interceptions per game"],
    plainDefinition: "INT per game is average interceptions thrown each game.",
    whyItMatters: "It shows turnover frequency in a rate form that is easier to compare across sample sizes.",
  }),
  term({
    sport: "NFL",
    key: "rush_yds",
    label: "Rush YDS",
    aliases: ["rushing yards"],
    plainDefinition: "Rushing yards are total yards gained on running plays.",
    whyItMatters: "They capture on-the-ground production for backs and mobile quarterbacks.",
  }),
  term({
    sport: "NFL",
    key: "rush_ypg",
    label: "Rush YPG",
    aliases: ["rushing yards per game"],
    plainDefinition: "Rushing yards per game is average rushing yards each game.",
    whyItMatters: "It normalizes rushing production across players with different workloads.",
  }),
  term({
    sport: "NFL",
    key: "rush_td",
    label: "Rush TD",
    aliases: ["rushing touchdowns"],
    plainDefinition: "Rushing touchdowns count scores on running plays.",
    whyItMatters: "They capture direct scoring value near the goal line and in explosive run situations.",
  }),
  term({
    sport: "NFL",
    key: "rush_tdpg",
    label: "Rush TD/G",
    aliases: ["rushing touchdowns per game"],
    plainDefinition: "Rush TD per game is average rushing touchdowns each game.",
    whyItMatters: "It compares rushing scoring output without being skewed by missed games.",
  }),
  term({
    sport: "NFL",
    key: "rec_yds",
    label: "Rec YDS",
    aliases: ["receiving yards"],
    plainDefinition: "Receiving yards are total yards gained on catches.",
    whyItMatters: "They describe how much a receiver contributes through the air.",
  }),
  term({
    sport: "NFL",
    key: "rec_ypg",
    label: "Rec YPG",
    aliases: ["receiving yards per game"],
    plainDefinition: "Receiving yards per game is average receiving yards each game.",
    whyItMatters: "It puts target-earners on a comparable per-game footing.",
  }),
  term({
    sport: "NFL",
    key: "rec_td",
    label: "Rec TD",
    aliases: ["receiving touchdowns"],
    plainDefinition: "Receiving touchdowns count touchdown catches.",
    whyItMatters: "They capture passing-game scoring production that often drives fantasy and betting interest.",
  }),
  term({
    sport: "NFL",
    key: "rec_tdpg",
    label: "Rec TD/G",
    aliases: ["receiving touchdowns per game"],
    plainDefinition: "Rec TD per game is average receiving touchdowns each game.",
    whyItMatters: "It compares scoring output across players with different sample sizes.",
  }),
];

export function normalizeGlossaryToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function toGlossarySport(value?: string | null): GlossarySport {
  const upper = (value ?? "").trim().toUpperCase();
  if (upper === "NFL" || upper === "NBA" || upper === "MLB" || upper === "UTILITIES") {
    return upper;
  }
  return "ALL";
}

function normalizeIncomingTerm(raw: RawGlossaryTerm): GlossaryTerm | null {
  const key = typeof raw.key === "string" ? raw.key.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const plainDefinition = typeof raw.plainDefinition === "string" ? raw.plainDefinition.trim() : "";
  const whyItMatters = typeof raw.whyItMatters === "string" ? raw.whyItMatters.trim() : "";

  if (!key || !label || !plainDefinition || !whyItMatters) {
    return null;
  }

  const aliases = Array.isArray(raw.aliases)
    ? raw.aliases.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : undefined;

  return {
    sport: toGlossarySport(typeof raw.sport === "string" ? raw.sport : null),
    key,
    label,
    plainDefinition,
    whyItMatters,
    advancedNotes: typeof raw.advancedNotes === "string" && raw.advancedNotes.trim().length > 0 ? raw.advancedNotes.trim() : undefined,
    learnMoreUrl: typeof raw.learnMoreUrl === "string" && raw.learnMoreUrl.trim().length > 0 ? raw.learnMoreUrl.trim() : undefined,
    aliases: aliases && aliases.length > 0 ? aliases : undefined,
  };
}

export function mergeGlossaryTerms(rawTerms: RawGlossaryTerm[] = []): GlossaryTerm[] {
  const merged = new Map<string, GlossaryTerm>();

  for (const entry of BUILTIN_GLOSSARY_TERMS) {
    merged.set(entry.key, entry);
  }

  for (const raw of rawTerms) {
    const normalized = normalizeIncomingTerm(raw);
    if (!normalized) {
      continue;
    }
    const previous = merged.get(normalized.key);
    merged.set(normalized.key, {
      ...previous,
      ...normalized,
      aliases: normalized.aliases ?? previous?.aliases,
    });
  }

  return Array.from(merged.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export function lookupGlossaryTerm(
  terms: GlossaryTerm[],
  lookup: GlossaryLookup,
): GlossaryTerm | null {
  const requestedSport = toGlossarySport(lookup.sport);
  const normalizedKey = lookup.key ? normalizeGlossaryToken(lookup.key) : "";
  const normalizedLabel = lookup.label ? normalizeGlossaryToken(lookup.label) : "";

  if (!normalizedKey && !normalizedLabel) {
    return null;
  }

  const scored = terms
    .map((termEntry) => {
      let score = 0;
      const candidateTokens = [
        termEntry.key,
        termEntry.label,
        ...(termEntry.aliases ?? []),
      ].map((value) => normalizeGlossaryToken(value));

      if (lookup.key && termEntry.key === lookup.key) {
        score += 100;
      }
      if (normalizedKey && candidateTokens.includes(normalizedKey)) {
        score += 80;
      }
      if (normalizedLabel && candidateTokens.includes(normalizedLabel)) {
        score += 70;
      }

      if (requestedSport === termEntry.sport) {
        score += 20;
      } else if (termEntry.sport === "ALL") {
        score += 10;
      }

      return { score, term: termEntry };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.term.label.localeCompare(right.term.label));

  return scored[0]?.term ?? null;
}
