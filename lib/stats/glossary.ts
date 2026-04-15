export type GlossarySport = "ALL" | "NFL" | "NBA" | "MLB" | "UTILITIES";

export type GlossaryDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "CONTEXT_DEPENDENT";

export type GlossaryCalculation = {
  formula: string;
  components: Array<{ name: string; description: string }>;
};

export type GlossaryTier = {
  label: string;
  range: string;
  description: string;
  color: "green" | "blue" | "gray" | "amber" | "red";
};

export type GlossaryTerm = {
  sport: GlossarySport;
  key: string;
  label: string;
  plainDefinition: string;
  whyItMatters: string;
  advancedNotes?: string;
  learnMoreUrl?: string;
  aliases?: string[];
  direction?: GlossaryDirection;
  interpretation?: string;
  calculation?: GlossaryCalculation;
  tiers?: GlossaryTier[];
  leagueAverage?: string;
  tags?: string[];
};

type GlossaryLookup = {
  key?: string | null;
  label?: string | null;
  sport?: string | null;
};

type RawGlossaryTerm = {
  sport?: unknown;
  key?: unknown;
  label?: unknown;
  plainDefinition?: unknown;
  whyItMatters?: unknown;
  advancedNotes?: unknown;
  learnMoreUrl?: unknown;
  aliases?: unknown;
  direction?: unknown;
  interpretation?: unknown;
  calculation?: unknown;
  tiers?: unknown;
  leagueAverage?: unknown;
  tags?: unknown;
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
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "avg",
    label: "AVG",
    aliases: ["batting average", "team avg"],
    plainDefinition: "Batting average is hits divided by at-bats.",
    whyItMatters: "It gives a quick read on how often a hitter or lineup records a hit.",
    advancedNotes: "AVG ignores walks and power, so it is best paired with OBP and SLG.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "Higher AVG usually means more consistent contact, but it still needs OBP and power context to tell the full offensive story.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/batting-average",
    calculation: {
      formula: "Hits ÷ At-Bats",
      components: [
        { name: "Hits", description: "Safely reaching base on a batted ball in fair territory." },
        { name: "At-Bats", description: "Plate appearances not ending in a walk, HBP, or sacrifice." },
      ],
    },
    tiers: [
      { label: "Elite", range: ".320+", description: "Exceptional contact quality — rare in modern baseball.", color: "green" },
      { label: "Strong", range: ".290–.319", description: "Well above the league average for consistent contact.", color: "blue" },
      { label: "Average", range: ".250–.289", description: "Near the league midpoint for contact rate.", color: "gray" },
      { label: "Struggling", range: "Below .250", description: "Below-average hit rate — power and walks carry more weight.", color: "amber" },
    ],
    leagueAverage: "League batting average typically hovers near .245–.255 in modern baseball.",
    tags: ["Contact rate", "Lineup quality", "Plate productivity"],
  }),
  term({
    sport: "MLB",
    key: "obp",
    label: "OBP",
    aliases: ["on-base percentage", "team obp"],
    plainDefinition: "On-base percentage measures how often a hitter reaches base by hit, walk, or hit-by-pitch.",
    whyItMatters: "Getting on base is the foundation of run scoring, so OBP is often more useful than AVG alone.",
    advancedNotes: "OBP captures patience and contact quality better than AVG because it rewards walks.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "A rising OBP usually means longer innings, more traffic, and more chances for the lineup behind that hitter.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/on-base-percentage",
    calculation: {
      formula: "(H + BB + HBP) ÷ (AB + BB + HBP + SF)",
      components: [
        { name: "Times on Base", description: "Hits, walks, and hit-by-pitches combined." },
        { name: "Plate Appearances", description: "All turns at bat excluding most sacrifice situations." },
      ],
    },
    tiers: [
      { label: "Elite", range: ".380+", description: "Exceptional patience and contact — creates maximum traffic.", color: "green" },
      { label: "Strong", range: ".350–.379", description: "Well above average — reliably reaches base.", color: "blue" },
      { label: "Average", range: ".315–.349", description: "Near the league norm for getting on base.", color: "gray" },
      { label: "Below average", range: "Below .315", description: "Gets out more than average — limits scoring chances.", color: "amber" },
    ],
    leagueAverage: "League OBP typically sits near .315–.325 in modern baseball.",
    tags: ["Plate discipline", "Base traffic", "Run creation"],
  }),
  term({
    sport: "MLB",
    key: "slg",
    label: "SLG",
    aliases: ["slugging", "slugging percentage", "team slg"],
    plainDefinition: "Slugging percentage measures total bases per at-bat.",
    whyItMatters: "It highlights extra-base power that simple hit totals can miss.",
    advancedNotes: "SLG is a power stat; pair it with OBP for a fuller view of overall offensive value.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "Higher SLG usually points to more doubles, triples, and homers, which raise a lineup's damage potential quickly.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/slugging-percentage",
    calculation: {
      formula: "Total Bases ÷ At-Bats",
      components: [
        { name: "Total Bases", description: "Singles=1, doubles=2, triples=3, home runs=4." },
        { name: "At-Bats", description: "Official plate appearances with a batted ball or strikeout outcome." },
      ],
    },
    tiers: [
      { label: "Power threat", range: ".500+", description: "Elite extra-base production — among the top power hitters.", color: "green" },
      { label: "Strong", range: ".430–.499", description: "Above-average power with consistent extra-base damage.", color: "blue" },
      { label: "Average", range: ".380–.429", description: "Typical slugging for a regular big-league hitter.", color: "gray" },
      { label: "Limited power", range: "Below .380", description: "Singles-heavy profile with less extra-base impact.", color: "amber" },
    ],
    leagueAverage: "League slugging percentage typically falls near .400–.420 in modern baseball.",
    tags: ["Power metric", "Extra-base production", "Contact quality"],
  }),
  term({
    sport: "MLB",
    key: "ops",
    label: "OPS",
    aliases: ["on-base plus slugging"],
    plainDefinition: "OPS adds on-base percentage and slugging percentage together.",
    whyItMatters: "It combines getting on base and hitting for power into one quick offensive snapshot.",
    advancedNotes: "OPS is widely used, but it weights OBP and SLG equally even though they do not contribute equally to run scoring.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "OPS climbs when a hitter both reaches base and drives the ball, so bigger numbers usually mean a more dangerous bat.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/on-base-plus-slugging",
    calculation: {
      formula: "OBP + SLG",
      components: [
        { name: "On-Base Percentage", description: "How often the hitter reaches base safely." },
        { name: "Slugging Percentage", description: "Total bases per at-bat — captures power output." },
      ],
    },
    tiers: [
      { label: "Elite", range: ".900+", description: "Superstar offensive production — among the best in the game.", color: "green" },
      { label: "Strong", range: ".800–.899", description: "Above-average bat — reliable run producer.", color: "blue" },
      { label: "Average", range: ".700–.799", description: "League-typical offensive output.", color: "gray" },
      { label: "Below average", range: "Below .700", description: "Weaker offensive threat — needs patience or power to contribute.", color: "amber" },
    ],
    leagueAverage: "League OPS typically falls near .720–.740 in modern baseball.",
    tags: ["Offensive value", "Power + patience", "Run production"],
  }),
  term({
    sport: "MLB",
    key: "hr",
    label: "HR",
    aliases: ["home runs"],
    plainDefinition: "Home runs count balls hit fair over the outfield fence or inside-the-park homers.",
    whyItMatters: "Home runs create instant scoring and are one of the fastest ways to change a game.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "rbi",
    label: "RBI",
    aliases: ["runs batted in"],
    plainDefinition: "Runs batted in count how many runs score because of a hitter's plate appearance, with a few scoring-rule exceptions.",
    whyItMatters: "RBI captures run production, especially in spots with runners on base.",
    advancedNotes: "RBI depends heavily on lineup context, so it should not be treated as a pure skill stat.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "walks",
    label: "BB",
    aliases: ["base on balls", "walks"],
    plainDefinition: "Walks are plate appearances that end with four balls and award first base.",
    whyItMatters: "They raise OBP and often signal plate discipline.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "strikeouts",
    label: "K",
    aliases: ["so", "strikeouts", "strike outs"],
    plainDefinition: "Strikeouts are plate appearances or batters retired with three strikes.",
    whyItMatters: "For hitters, fewer strikeouts can mean more balls in play. For pitchers, more strikeouts reduce reliance on defense.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "earned_runs",
    label: "ER",
    aliases: ["earned runs"],
    plainDefinition: "Earned runs are runs charged to a pitcher that score without the help of fielding errors or passed balls.",
    whyItMatters: "They are the raw input behind ERA and help explain how much damage happened in a specific outing.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "stolen_bases",
    label: "SB",
    aliases: ["steals", "stolen bases"],
    plainDefinition: "Stolen bases count successful advances to the next base while the ball is live and not put in play.",
    whyItMatters: "They add value on the bases and can quickly turn singles into scoring opportunities.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "era",
    label: "ERA",
    aliases: ["earned run average", "starters era", "bullpen era"],
    plainDefinition: "Earned run average is earned runs allowed per nine innings pitched.",
    whyItMatters: "It is the most familiar quick summary of run prevention for pitchers and staffs.",
    advancedNotes: "ERA is affected by defense, sequencing, and official scoring, so it should be paired with WHIP and strikeout rates.",
    direction: "LOWER_IS_BETTER",
    interpretation: "Lower ERA generally means cleaner run prevention, but it can still be influenced by defense, ballpark, and sequencing.",
    learnMoreUrl: "https://www.mlb.com/glossary/standard-stats/earned-run-average",
    calculation: {
      formula: "(Earned Runs ÷ Innings Pitched) × 9",
      components: [
        { name: "Earned Runs", description: "Runs that scored without the help of errors or passed balls." },
        { name: "Innings Pitched", description: "Used to turn earned runs into a per-inning rate." },
        { name: "Scale (×9)", description: "Projects the rate to a full nine-inning game." },
      ],
    },
    tiers: [
      { label: "Ace-level", range: "Below 3.00", description: "Elite run prevention — top of the rotation quality.", color: "green" },
      { label: "Solid", range: "3.00–3.99", description: "Above-average starter or trusted high-leverage arm.", color: "blue" },
      { label: "League average", range: "4.00–4.74", description: "Serviceable but not a run-prevention weapon.", color: "gray" },
      { label: "Vulnerable", range: "4.75+", description: "Elevated damage risk — context and ballpark matter a lot here.", color: "amber" },
    ],
    leagueAverage: "League ERA typically hovers near 4.0–4.3 in modern baseball.",
    tags: ["Run prevention", "Starter value", "Pitching quality"],
  }),
  term({
    sport: "MLB",
    key: "whip",
    label: "WHIP",
    aliases: ["walks plus hits per inning pitched"],
    plainDefinition: "WHIP measures walks plus hits allowed per inning pitched.",
    whyItMatters: "It shows how often a pitcher allows traffic on the bases.",
    advancedNotes: "Lower WHIP usually means fewer scoring chances created for the opponent.",
    direction: "LOWER_IS_BETTER",
    interpretation: "WHIP is a traffic meter. The closer it stays to one baserunner per inning or below, the steadier the run-prevention profile usually is.",
    learnMoreUrl: "https://www.mlb.com/glossary/advanced-stats/walks-and-hits-per-inning-pitched",
    calculation: {
      formula: "(Walks + Hits) ÷ Innings Pitched",
      components: [
        { name: "Walks", description: "Free baserunners granted by the pitcher." },
        { name: "Hits", description: "Hits allowed that put runners on base." },
        { name: "Innings Pitched", description: "Divides baserunner total into a per-inning rate." },
      ],
    },
    tiers: [
      { label: "Elite", range: "Below 1.00", description: "Barely a baserunner per inning — exceptional control.", color: "green" },
      { label: "Strong", range: "1.00–1.19", description: "Clean and consistent — above-average run prevention.", color: "blue" },
      { label: "Average", range: "1.20–1.39", description: "League-typical traffic levels.", color: "gray" },
      { label: "Leaky", range: "1.40+", description: "More than one baserunner per inning — damage risk rises.", color: "amber" },
    ],
    leagueAverage: "League average WHIP is typically near 1.25–1.30.",
    tags: ["Traffic prevention", "Command metric"],
  }),
  term({
    sport: "MLB",
    key: "innings_pitched",
    label: "IP",
    aliases: ["innings pitched", "inningspitched"],
    plainDefinition: "Innings pitched shows how many outs a pitcher recorded, expressed in innings.",
    whyItMatters: "It gives workload and sample-size context for ERA, WHIP, and strikeout stats.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "wins",
    label: "W",
    aliases: ["wins"],
    plainDefinition: "Pitcher wins credit the pitcher of record when his team takes the lead for good.",
    whyItMatters: "Wins are a familiar result stat, but they also depend heavily on team offense and bullpen support.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "losses",
    label: "L",
    aliases: ["losses"],
    plainDefinition: "Pitcher losses are charged when a pitcher is responsible for the lead that the opponent never gives back.",
    whyItMatters: "Like wins, losses are outcome-based and often reflect team context as much as pitcher skill.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "ALL",
    key: "w_l_record",
    label: "W-L",
    aliases: ["record", "win loss record"],
    plainDefinition: "W-L shows wins and losses together as a record line.",
    whyItMatters: "It gives a fast summary of results, especially for pitchers, teams, or standings tables.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "ALL",
    key: "wins_record",
    label: "W",
    aliases: ["wins", "team wins"],
    plainDefinition: "Wins count how many games a team won in the selected sample.",
    whyItMatters: "They are the clearest standings signal because the goal is to win games, not just outgain opponents.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "ALL",
    key: "losses_record",
    label: "L",
    aliases: ["losses", "team losses"],
    plainDefinition: "Losses count how many games a team lost in the selected sample.",
    whyItMatters: "They show how often a team failed to finish drives, stops, and late-game situations strongly enough to win.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "ALL",
    key: "ties",
    label: "T",
    aliases: ["ties", "draws"],
    plainDefinition: "Ties count games that ended even after the league's overtime rules were exhausted.",
    whyItMatters: "They affect record, winning percentage, and tiebreak math even when they are rare.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "ALL",
    key: "streak",
    label: "Streak",
    aliases: ["current streak", "win streak", "loss streak"],
    plainDefinition: "Streak shows whether a team has been stringing together wins or losses lately.",
    whyItMatters: "It gives quick momentum context, though it should be paired with opponent quality and overall record.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "games_started",
    label: "GS",
    aliases: ["games started"],
    plainDefinition: "Games started count how many times a pitcher or player was in the starting lineup.",
    whyItMatters: "It separates rotation workload from relief work and helps explain sample size.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "opponent_avg",
    label: "Opp AVG",
    aliases: ["opponent batting average", "opponentavg"],
    plainDefinition: "Opponent batting average shows how often hitters get hits against a pitcher.",
    whyItMatters: "It is a simple way to judge how difficult a pitcher has been to square up.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "k_per_9",
    label: "K/9",
    aliases: ["k9", "kper9", "strikeouts per nine"],
    plainDefinition: "K/9 estimates how many strikeouts a pitcher records every nine innings.",
    whyItMatters: "Higher strikeout rates usually mean less dependence on defense and more direct run prevention skill.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "Higher K/9 usually signals bat-missing stuff and more escape routes in leverage spots because fewer balls are put in play.",
    calculation: {
      formula: "(Strikeouts ÷ Innings Pitched) × 9",
      components: [
        { name: "Strikeouts", description: "Total batters retired via strikeout." },
        { name: "Innings Pitched", description: "Used to turn strikeouts into a rate stat." },
        { name: "Scale (×9)", description: "Projects the rate to a full nine-inning game." },
      ],
    },
    tiers: [
      { label: "Bat-missing", range: "10.0+", description: "Premium swing-and-miss stuff.", color: "green" },
      { label: "Strong", range: "8.5–9.9", description: "Above-average strikeout rate.", color: "blue" },
      { label: "Average", range: "7.5–8.4", description: "Normal swing-and-miss profile.", color: "gray" },
      { label: "Contact-heavy", range: "Below 7.5", description: "More balls in play to manage.", color: "amber" },
    ],
    leagueAverage: "League average is often near 8.5 K/9.",
    tags: ["Swing-and-miss", "Pitcher dominance", "DFS upside"],
  }),
  term({
    sport: "MLB",
    key: "bb_per_9",
    label: "BB/9",
    aliases: ["bb9", "bbper9", "walks per nine"],
    plainDefinition: "BB/9 estimates how many walks a pitcher allows every nine innings.",
    whyItMatters: "Lower walk rates usually mean better command and fewer free baserunners.",
    direction: "LOWER_IS_BETTER",
    interpretation: "When BB/9 stays low, pitchers force hitters to earn their way on instead of handing out free traffic.",
    calculation: {
      formula: "(Walks ÷ Innings Pitched) × 9",
      components: [
        { name: "Walks", description: "Free baserunners granted by failing to throw strikes consistently." },
        { name: "Innings Pitched", description: "Used to normalize walk frequency across different workloads." },
        { name: "Scale (×9)", description: "Projects the rate to a standard nine-inning game." },
      ],
    },
    tiers: [
      { label: "Elite control", range: "Below 2.0", description: "Exceptional command — almost never walks batters.", color: "green" },
      { label: "Strong", range: "2.0–2.9", description: "Good command with minimal free passes.", color: "blue" },
      { label: "Average", range: "3.0–3.9", description: "Typical walk rate for a major league pitcher.", color: "gray" },
      { label: "Wild", range: "4.0+", description: "Elevated walk rate — pitches behind in counts more often.", color: "amber" },
    ],
    leagueAverage: "League average BB/9 is typically near 3.0–3.5.",
    tags: ["Command metric", "Walk prevention", "Control"],
  }),
  term({
    sport: "MLB",
    key: "hr_per_9",
    label: "HR/9",
    aliases: ["hr9", "hrper9", "home runs per nine"],
    plainDefinition: "HR/9 estimates how many home runs a pitcher allows every nine innings.",
    whyItMatters: "Home-run suppression matters because homers create immediate damage.",
    direction: "LOWER_IS_BETTER",
    interpretation: "A lower HR/9 usually means fewer instant run swings and less damage on contact mistakes.",
    calculation: {
      formula: "(Home Runs Allowed ÷ Innings Pitched) × 9",
      components: [
        { name: "Home Runs Allowed", description: "Total home runs surrendered across all outings in the sample." },
        { name: "Innings Pitched", description: "Converts the HR count to a per-inning frequency." },
        { name: "Scale (×9)", description: "Projects the per-inning rate to a standard nine-inning game." },
      ],
    },
    tiers: [
      { label: "Suppressing", range: "Below 0.8", description: "Rarely gives up long balls — strong fly ball management.", color: "green" },
      { label: "Strong", range: "0.8–1.1", description: "Near or below the league average for home run rate.", color: "blue" },
      { label: "Average", range: "1.2–1.4", description: "Typical home run rate for a major league pitcher.", color: "gray" },
      { label: "Vulnerable", range: "1.5+", description: "Elevated home run rate — more swing damage risk.", color: "amber" },
    ],
    leagueAverage: "League HR/9 typically falls near 1.2–1.4 in the current era.",
    tags: ["Power suppression", "Home run prevention", "Fly ball risk"],
  }),
  term({
    sport: "ALL",
    key: "win_pct",
    label: "Pct",
    aliases: ["winning percentage", "win%", "win pct"],
    plainDefinition: "Winning percentage is wins divided by total decisions or games played.",
    whyItMatters: "It normalizes record so teams or players with different game totals are easier to compare.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "Higher winning percentage means better results over the selected sample, especially when teams have played different numbers of games.",
  }),
  term({
    sport: "NFL",
    key: "points_for",
    label: "PF",
    aliases: ["points for", "team points scored"],
    plainDefinition: "Points for is the total number of points a team scored.",
    whyItMatters: "It gives a fast read on how much scoring pressure that team created across the season.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "points_against",
    label: "PA",
    aliases: ["points against", "team points allowed"],
    plainDefinition: "Points against is the total number of points a team allowed.",
    whyItMatters: "It helps show how often that defense kept opponents from turning drives into points.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "playoff_seed",
    label: "Playoff Seed",
    aliases: ["seed", "conference seed"],
    plainDefinition: "Playoff seed is the team's conference slot after the regular season standings are finalized.",
    whyItMatters: "It determines playoff path, home-field context, and whether a team qualified at all.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "clinched",
    label: "Clinched",
    aliases: ["playoff berth clinched", "clinched playoff spot"],
    plainDefinition: "Clinched means a team has already secured a playoff berth or locked in a postseason slot.",
    whyItMatters: "It separates teams still chasing leverage games from teams that already secured a postseason path.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "games_back",
    label: "GB",
    aliases: ["games back"],
    plainDefinition: "Games back shows how far a team trails the division or conference leader in the standings.",
    whyItMatters: "It gives fast context for where a team sits in the race.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "runs_scored",
    label: "Runs",
    aliases: ["runs scored"],
    plainDefinition: "Runs scored are the total runs a hitter, lineup, or team has produced.",
    whyItMatters: "Scoring is the direct offensive objective, so runs provide bottom-line production context.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "runs_allowed",
    label: "RA",
    aliases: ["runs allowed"],
    plainDefinition: "Runs allowed are the total runs a team or pitching staff has given up.",
    whyItMatters: "It is a direct team-level measure of run prevention.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "saves",
    label: "Saves",
    aliases: ["save"],
    plainDefinition: "Saves credit relievers who finish certain close wins while preserving the lead.",
    whyItMatters: "They describe bullpen conversion in traditional late-game situations.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "blown_saves",
    label: "BS",
    aliases: ["blown saves", "blown save"],
    plainDefinition: "Blown saves count save opportunities that a reliever fails to convert.",
    whyItMatters: "They add context to bullpen reliability in leverage spots.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "batters_faced",
    label: "BF",
    aliases: ["batters faced"],
    plainDefinition: "Batters faced count how many hitters a pitcher has seen.",
    whyItMatters: "It helps frame whether split lines come from meaningful sample size or very small usage.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "run_differential",
    label: "Run Differential",
    aliases: ["run diff"],
    plainDefinition: "Run differential is runs scored minus runs allowed.",
    whyItMatters: "Over time it is often more predictive of team quality than raw win-loss record.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "Positive and rising run differential usually means a team is controlling games, not just surviving close finishes.",
  }),
  term({
    sport: "MLB",
    key: "weighted_win_pct",
    label: "Weighted Win%",
    aliases: ["weighted win pct", "weighted winning percentage"],
    plainDefinition: "Weighted win percentage blends performance across multiple recent windows instead of using only one stretch.",
    whyItMatters: "It smooths noise while still rewarding the freshest results more heavily than older ones.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "MLB",
    key: "run_diff_per_game",
    label: "R/G Diff",
    aliases: ["run differential per game", "runs per game differential"],
    plainDefinition: "Run differential per game is average runs scored minus average runs allowed over the selected sample.",
    whyItMatters: "It shows whether a team is merely winning games or actually controlling them.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "The further this climbs above zero, the more convincingly a team is outplaying opponents on a per-game basis.",
  }),
  term({
    sport: "MLB",
    key: "days_rest",
    label: "Rest",
    aliases: ["days rest"],
    plainDefinition: "Days rest count how many days have passed since a pitcher's last outing.",
    whyItMatters: "Rest is a quick proxy for freshness, availability, and likely workload tolerance.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "pitches_strikes",
    label: "P/S",
    aliases: ["pitches strikes", "pitches/strikes"],
    plainDefinition: "P/S shows total pitches thrown and how many of them were strikes.",
    whyItMatters: "It combines workload with basic command information in one compact line.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "re24",
    label: "RE24",
    aliases: ["run expectancy"],
    plainDefinition: "RE24 is the average number of runs teams score from a specific base-out state until the inning ends.",
    whyItMatters: "It turns every base and out situation into a concrete run-scoring expectation.",
    advancedNotes: "The same baserunners can have very different value depending on outs, which is why RE24 is useful for strategy and context.",
    direction: "CONTEXT_DEPENDENT",
    interpretation: "This is best read as a situation-value stat. The number rises when the base-out state becomes more dangerous for the defense.",
    learnMoreUrl: "https://www.mlb.com/glossary/advanced-stats/re24",
  }),
  term({
    sport: "MLB",
    key: "score_probability",
    label: "Probability of scoring",
    aliases: ["score pct", "scoring probability"],
    plainDefinition: "Probability of scoring is the chance that at least one run will score from the current base-out state before the inning ends.",
    whyItMatters: "It explains how threatening a situation is even when expected runs look similar.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "MLB",
    key: "delta_vs_baseline",
    label: "Delta vs baseline",
    aliases: ["delta versus baseline"],
    plainDefinition: "Delta vs baseline is the difference between the selected situation and a reference state, usually bases empty with no outs.",
    whyItMatters: "It shows how much extra run value a state gains or loses compared with a neutral inning start.",
    direction: "CONTEXT_DEPENDENT",
  }),
  term({
    sport: "NBA",
    key: "ppg",
    label: "PPG",
    aliases: ["points per game"],
    plainDefinition: "Points per game is average points scored each game.",
    whyItMatters: "It is the fastest summary of scoring volume.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NBA",
    key: "rpg",
    label: "RPG",
    aliases: ["rebounds per game"],
    plainDefinition: "Rebounds per game is average rebounds each game.",
    whyItMatters: "It tracks how often a player ends possessions or extends them with offensive boards.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NBA",
    key: "apg",
    label: "APG",
    aliases: ["assists per game"],
    plainDefinition: "Assists per game is average assists each game.",
    whyItMatters: "It is a quick signal of playmaking responsibility and creation volume.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NBA",
    key: "ts",
    label: "TS%",
    aliases: ["true shooting", "true shooting percentage"],
    plainDefinition: "True shooting percentage estimates scoring efficiency by combining twos, threes, and free throws.",
    whyItMatters: "It is one of the cleanest all-in-one scoring efficiency metrics in basketball.",
    direction: "HIGHER_IS_BETTER",
    interpretation: "Higher TS% usually means a scorer is converting possessions efficiently across twos, threes, and free throws.",
    learnMoreUrl: "https://www.nba.com/stats/help/glossary",
  }),
  term({
    sport: "NFL",
    key: "pass_yds",
    label: "Pass YDS",
    aliases: ["passing yards"],
    plainDefinition: "Passing yards are total yards gained through completed passes.",
    whyItMatters: "They summarize quarterback and passing-game volume.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "pass_ypg",
    label: "Pass YPG",
    aliases: ["passing yards per game"],
    plainDefinition: "Passing yards per game is average passing yards each game.",
    whyItMatters: "It normalizes production across players with different game totals.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "pass_td",
    label: "Pass TD",
    aliases: ["passing touchdowns"],
    plainDefinition: "Pass TD counts touchdown passes thrown by a quarterback.",
    whyItMatters: "Touchdown creation is a direct measure of passing-game scoring impact.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "pass_tdpg",
    label: "Pass TD/G",
    aliases: ["passing touchdowns per game"],
    plainDefinition: "Pass TD per game is average touchdown passes thrown each game.",
    whyItMatters: "It compares scoring production on a per-game basis instead of raw season totals.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "int",
    label: "INT",
    aliases: ["interceptions"],
    plainDefinition: "Interceptions are passes caught by the defense.",
    whyItMatters: "They are one of the most costly passing mistakes because they end drives and often flip field position.",
    direction: "LOWER_IS_BETTER",
    interpretation: "Lower interception rates usually mean cleaner decision-making and fewer drive-killing mistakes.",
  }),
  term({
    sport: "NFL",
    key: "intpg",
    label: "INT/G",
    aliases: ["interceptions per game"],
    plainDefinition: "INT per game is average interceptions thrown each game.",
    whyItMatters: "It shows turnover frequency in a rate form that is easier to compare across sample sizes.",
    direction: "LOWER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rush_yds",
    label: "Rush YDS",
    aliases: ["rushing yards"],
    plainDefinition: "Rushing yards are total yards gained on running plays.",
    whyItMatters: "They capture on-the-ground production for backs and mobile quarterbacks.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rush_ypg",
    label: "Rush YPG",
    aliases: ["rushing yards per game"],
    plainDefinition: "Rushing yards per game is average rushing yards each game.",
    whyItMatters: "It normalizes rushing production across players with different workloads.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rush_td",
    label: "Rush TD",
    aliases: ["rushing touchdowns"],
    plainDefinition: "Rushing touchdowns count scores on running plays.",
    whyItMatters: "They capture direct scoring value near the goal line and in explosive run situations.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rush_tdpg",
    label: "Rush TD/G",
    aliases: ["rushing touchdowns per game"],
    plainDefinition: "Rush TD per game is average rushing touchdowns each game.",
    whyItMatters: "It compares rushing scoring output without being skewed by missed games.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rec_yds",
    label: "Rec YDS",
    aliases: ["receiving yards"],
    plainDefinition: "Receiving yards are total yards gained on catches.",
    whyItMatters: "They describe how much a receiver contributes through the air.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rec_ypg",
    label: "Rec YPG",
    aliases: ["receiving yards per game"],
    plainDefinition: "Receiving yards per game is average receiving yards each game.",
    whyItMatters: "It puts target-earners on a comparable per-game footing.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rec_td",
    label: "Rec TD",
    aliases: ["receiving touchdowns"],
    plainDefinition: "Receiving touchdowns count touchdown catches.",
    whyItMatters: "They capture passing-game scoring production that often drives fantasy and betting interest.",
    direction: "HIGHER_IS_BETTER",
  }),
  term({
    sport: "NFL",
    key: "rec_tdpg",
    label: "Rec TD/G",
    aliases: ["receiving touchdowns per game"],
    plainDefinition: "Rec TD per game is average receiving touchdowns each game.",
    whyItMatters: "It compares scoring output across players with different sample sizes.",
    direction: "HIGHER_IS_BETTER",
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

function normalizeGlossaryDirection(value: unknown): GlossaryDirection | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const upper = value.trim().toUpperCase();
  if (upper === "HIGHER_IS_BETTER" || upper === "LOWER_IS_BETTER" || upper === "CONTEXT_DEPENDENT") {
    return upper;
  }

  return undefined;
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
    direction: normalizeGlossaryDirection(raw.direction),
    interpretation: typeof raw.interpretation === "string" && raw.interpretation.trim().length > 0 ? raw.interpretation.trim() : undefined,
    calculation: raw.calculation != null && typeof raw.calculation === "object" ? (raw.calculation as GlossaryCalculation) : undefined,
    tiers: Array.isArray(raw.tiers) ? (raw.tiers as GlossaryTier[]) : undefined,
    leagueAverage: typeof raw.leagueAverage === "string" && raw.leagueAverage.trim().length > 0 ? raw.leagueAverage.trim() : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : undefined,
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
      advancedNotes: normalized.advancedNotes ?? previous?.advancedNotes,
      learnMoreUrl: normalized.learnMoreUrl ?? previous?.learnMoreUrl,
      aliases: normalized.aliases ?? previous?.aliases,
      direction: normalized.direction ?? previous?.direction,
      interpretation: normalized.interpretation ?? previous?.interpretation,
      calculation: normalized.calculation ?? previous?.calculation,
      tiers: normalized.tiers ?? previous?.tiers,
      leagueAverage: normalized.leagueAverage ?? previous?.leagueAverage,
      tags: normalized.tags ?? previous?.tags,
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

// ---------------------------------------------------------------------------
// Universal explainer enrichment — shared fallback pipeline
// ---------------------------------------------------------------------------

type StatCategory =
  | "rate_pitcher"
  | "counting_pitcher"
  | "rate_hitter"
  | "counting_hitter"
  | "team"
  | "situational"
  | "workload"
  | "nba"
  | "nfl";

function inferStatCategory(t: GlossaryTerm): StatCategory {
  if (t.sport === "NBA") return "nba";
  if (t.sport === "NFL") return "nfl";
  const k = t.key;
  if (k.endsWith("_per_9") || k.endsWith("_per9")) return "rate_pitcher";
  if (
    ["era", "whip", "innings_pitched", "wins", "losses", "games_started", "saves",
     "earned_runs", "batters_faced", "opponent_avg", "blown_saves"].includes(k)
  ) return "counting_pitcher";
  if (["avg", "obp", "slg", "ops"].includes(k)) return "rate_hitter";
  if (["re24", "score_probability", "delta_vs_baseline", "pitches_strikes"].includes(k)) return "situational";
  if (["games_played", "days_rest"].includes(k)) return "workload";
  if (
    ["runs_scored", "runs_allowed", "run_differential", "run_diff_per_game",
     "weighted_win_pct", "games_back", "win_pct", "w_l_record", "wins_record", "losses_record",
     "ties", "streak", "points_for", "points_against", "playoff_seed", "clinched"].includes(k)
  ) return "team";
  return "counting_hitter";
}

function fallbackTags(cat: StatCategory, direction: GlossaryDirection): string[] {
  switch (cat) {
    case "rate_pitcher":
      return ["Pitching quality", "Rate stat", "Run prevention"];
    case "counting_pitcher":
      return ["Pitching volume", "Workload context"];
    case "rate_hitter":
      return ["Offensive efficiency", "Rate stat", "Contact quality"];
    case "counting_hitter":
      return direction === "LOWER_IS_BETTER"
        ? ["Plate discipline", "Volume metric"]
        : ["Offensive value", "Volume metric"];
    case "team":
      return ["Team performance", "Game context"];
    case "situational":
      return ["Situational value", "Strategic context"];
    case "workload":
      return ["Usage context", "Availability"];
    case "nba":
      return direction === "HIGHER_IS_BETTER"
        ? ["Basketball metric", "Offensive production"]
        : ["Basketball metric", "Efficiency"];
    case "nfl":
      return direction === "HIGHER_IS_BETTER"
        ? ["Football metric", "Offensive output"]
        : ["Football metric", "Ball security"];
  }
}

function fallbackCalculation(t: GlossaryTerm, cat: StatCategory): GlossaryCalculation {
  switch (cat) {
    case "rate_pitcher":
      return {
        formula: "(Season total ÷ Innings Pitched) × 9",
        components: [
          { name: "Season Total", description: "Cumulative count of the event across all outings in the sample." },
          { name: "Innings Pitched", description: "Converts the raw count to a per-inning frequency." },
          { name: "Scale (×9)", description: "Projects the per-inning rate to a standard nine-inning game." },
        ],
      };
    case "rate_hitter":
      return {
        formula: "Successful outcomes ÷ Opportunities",
        components: [
          { name: "Successful outcomes", description: "The positive batting result being measured (hits, total bases, times on base, etc.)." },
          { name: "Opportunities", description: "Total at-bats or plate appearances in the selected sample." },
        ],
      };
    case "counting_pitcher":
    case "counting_hitter":
      return {
        formula: "Season counting total",
        components: [
          { name: t.label, description: t.plainDefinition },
        ],
      };
    case "team":
      return {
        formula: "Aggregated from team game log",
        components: [
          { name: "Team totals", description: "Compiled from official box scores across all games in the selected sample." },
        ],
      };
    case "situational":
      return {
        formula: "Derived from historical play-by-play data",
        components: [
          { name: "Base-out state", description: "The specific combination of baserunners and outs at the moment of the play." },
          { name: "Historical run outcomes", description: "Thousands of similar situations averaged to produce an expected run value." },
        ],
      };
    case "workload":
      return {
        formula: "Counted from official schedule and game log data",
        components: [
          { name: "Official records", description: "Sourced directly from team transaction and appearance data." },
        ],
      };
    case "nba":
      return {
        formula: "Season total ÷ Games played",
        components: [
          { name: "Season total", description: "Cumulative count across all appearances in the selected sample." },
          { name: "Games played", description: "Converts counting totals to a per-game rate for fair comparison." },
        ],
      };
    case "nfl":
      return {
        formula: "Season counting total or per-game rate",
        components: [
          { name: "Season total", description: "Cumulative across all games in the selected sample." },
        ],
      };
  }
}

function fallbackTiers(direction: GlossaryDirection): GlossaryTier[] {
  if (direction === "CONTEXT_DEPENDENT") return [];
  if (direction === "HIGHER_IS_BETTER") {
    return [
      { label: "Elite", range: "Top 10%", description: "Consistently among the best performers in the league at this metric.", color: "green" },
      { label: "Above average", range: "Top 25%", description: "Meaningfully above the league midpoint.", color: "blue" },
      { label: "Average", range: "Near median", description: "Close to the typical output for a regular player or team.", color: "gray" },
      { label: "Below average", range: "Bottom 25%", description: "Below the league median — room to improve relative to peers.", color: "amber" },
    ];
  } else {
    return [
      { label: "Elite", range: "Bottom 10%", description: "Among the best in the league at minimizing this stat.", color: "green" },
      { label: "Strong", range: "Bottom 25%", description: "Consistently better than the league midpoint.", color: "blue" },
      { label: "Average", range: "Near median", description: "Close to typical league levels for this stat.", color: "gray" },
      { label: "Elevated", range: "Top 25%", description: "Above-average — context and sample size matter here.", color: "amber" },
    ];
  }
}

function fallbackAdvancedNotes(cat: StatCategory): string {
  switch (cat) {
    case "rate_pitcher":
      return "Rate stats stabilize over larger sample sizes. Avoid strong conclusions from fewer than 10–15 innings pitched.";
    case "counting_pitcher":
      return "Counting totals accumulate with playing time. Compare pitchers with similar workloads for a fair read.";
    case "rate_hitter":
      return "Rate stats are most reliable over 100+ plate appearances. Early-season samples should be interpreted cautiously.";
    case "counting_hitter":
      return "Counting totals are sensitive to playing time. Pair with rate stats for a more complete offensive picture.";
    case "team":
      return "Team aggregates smooth out individual game variance. Longer stretches provide more predictive signal.";
    case "situational":
      return "Situational stats can be skewed by small samples or opponent quality. Use as context alongside broader performance metrics.";
    case "workload":
      return "Workload metrics are most useful for game-day context. Pair with performance data for a fuller picture.";
    case "nba":
      return "Advanced basketball metrics stabilize over 20–30 games. Early-season samples can be misleading.";
    case "nfl":
      return "NFL stats can shift significantly based on game script, opponent strength, and weather. Sample size matters.";
  }
}

/**
 * Enriches a GlossaryTerm with shared fallback content for any missing premium
 * sections. Every term that passes through this function is guaranteed to have:
 * - direction resolved (never undefined)
 * - tags (authored or category-based)
 * - calculation (authored or category-based explanation)
 * - tiers for non-CONTEXT_DEPENDENT stats (authored or generic scale)
 * - advancedNotes (authored or category-based)
 *
 * Authored metadata is never overwritten. This is called by StatExplainerProvider
 * before setting the active term, so the modal always receives a fully enriched term.
 */
export function enrichTermWithFallbacks(t: GlossaryTerm): GlossaryTerm {
  const direction: GlossaryDirection = t.direction ?? "CONTEXT_DEPENDENT";
  const cat = inferStatCategory(t);
  const generatedTiers = direction !== "CONTEXT_DEPENDENT" ? fallbackTiers(direction) : undefined;
  return {
    ...t,
    direction,
    tags: t.tags ?? fallbackTags(cat, direction),
    calculation: t.calculation ?? fallbackCalculation(t, cat),
    tiers: t.tiers ?? generatedTiers,
    advancedNotes: t.advancedNotes ?? fallbackAdvancedNotes(cat),
  };
}
