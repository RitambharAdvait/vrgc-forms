export type GameTypeId = "valorant" | "cs2" | "bgmi" | "rocket_league" | "custom";

export interface GameSideTheme {
  label: string;
  fullLabel: string;
  defaultColor: string;
  defaultLogo: string;
}

export interface GameSideConfig {
  side1: GameSideTheme;
  side2: GameSideTheme;
  hasHalftimeSideSwap: boolean;
}

export interface GameScoringRules {
  type: "round_based" | "points_based" | "goals_based";
  roundsToWinRegulation: number;
  halfTimeAtRound: number;
  overtimeTriggerScore: number;
  winByTwoRequired: boolean;
  defaultTimeoutsPerTeam: number;
}

export interface GameProfile {
  id: GameTypeId;
  displayName: string;
  category: "Tactical Shooter" | "Battle Royale" | "Sports / Arena" | "MOBA";
  defaultTournamentName: string;
  defaultSeriesFormat: "BO1" | "BO3" | "BO5";
  sides: GameSideConfig;
  maps: string[];
  scoring: GameScoringRules;
}

// ── Valorant Official Profile ──────────────────────────────────────────────
export const VALORANT_PROFILE: GameProfile = {
  id: "valorant",
  displayName: "Valorant",
  category: "Tactical Shooter",
  defaultTournamentName: "VRGC Valorant Invitational",
  defaultSeriesFormat: "BO3",
  sides: {
    side1: {
      label: "ATK",
      fullLabel: "Attackers",
      defaultColor: "#ff4655",
      defaultLogo: "/assets/teams/team_attackers.svg",
    },
    side2: {
      label: "DEF",
      fullLabel: "Defenders",
      defaultColor: "#00f0ff",
      defaultLogo: "/assets/teams/team_defenders.svg",
    },
    hasHalftimeSideSwap: true,
  },
  maps: [
    "Ascent",
    "Bind",
    "Haven",
    "Split",
    "Sunset",
    "Lotus",
    "Abyss",
    "Breeze",
    "Icebox",
    "Fracture",
    "Pearl",
  ],
  scoring: {
    type: "round_based",
    roundsToWinRegulation: 13,
    halfTimeAtRound: 12,
    overtimeTriggerScore: 12,
    winByTwoRequired: true,
    defaultTimeoutsPerTeam: 2,
  },
};

// ── CS2 Profile (Prepared for Future Extension) ───────────────────────────
export const CS2_PROFILE: GameProfile = {
  id: "cs2",
  displayName: "Counter-Strike 2",
  category: "Tactical Shooter",
  defaultTournamentName: "VRGC CS2 Major Championship",
  defaultSeriesFormat: "BO3",
  sides: {
    side1: {
      label: "T",
      fullLabel: "Terrorists",
      defaultColor: "#de9b35",
      defaultLogo: "/assets/teams/team_attackers.svg",
    },
    side2: {
      label: "CT",
      fullLabel: "Counter-Terrorists",
      defaultColor: "#5d79ae",
      defaultLogo: "/assets/teams/team_defenders.svg",
    },
    hasHalftimeSideSwap: true,
  },
  maps: [
    "Mirage",
    "Inferno",
    "Nuke",
    "Dust II",
    "Ancient",
    "Anubis",
    "Vertigo",
  ],
  scoring: {
    type: "round_based",
    roundsToWinRegulation: 13,
    halfTimeAtRound: 12,
    overtimeTriggerScore: 12,
    winByTwoRequired: true,
    defaultTimeoutsPerTeam: 2,
  },
};

// ── BGMI Profile (Prepared for Future Extension) ──────────────────────────
export const BGMI_PROFILE: GameProfile = {
  id: "bgmi",
  displayName: "BGMI / PUBG Mobile",
  category: "Battle Royale",
  defaultTournamentName: "VRGC Battlegrounds Showdown",
  defaultSeriesFormat: "BO5",
  sides: {
    side1: {
      label: "SQUAD 1",
      fullLabel: "Squad Alpha",
      defaultColor: "#f59e0b",
      defaultLogo: "/assets/teams/team_attackers.svg",
    },
    side2: {
      label: "SQUAD 2",
      fullLabel: "Squad Bravo",
      defaultColor: "#3b82f6",
      defaultLogo: "/assets/teams/team_defenders.svg",
    },
    hasHalftimeSideSwap: false,
  },
  maps: [
    "Erangel",
    "Miramar",
    "Sanhok",
    "Vikendi",
    "Livik",
    "Karakin",
  ],
  scoring: {
    type: "points_based",
    roundsToWinRegulation: 0,
    halfTimeAtRound: 0,
    overtimeTriggerScore: 0,
    winByTwoRequired: false,
    defaultTimeoutsPerTeam: 0,
  },
};

// ── Registry of Supported Game Profiles ──────────────────────────────────
export const GAME_PROFILES: Record<GameTypeId, GameProfile> = {
  valorant: VALORANT_PROFILE,
  cs2: CS2_PROFILE,
  bgmi: BGMI_PROFILE,
  rocket_league: {
    id: "rocket_league",
    displayName: "Rocket League",
    category: "Sports / Arena",
    defaultTournamentName: "VRGC Rocket League Clash",
    defaultSeriesFormat: "BO5",
    sides: {
      side1: {
        label: "BLUE",
        fullLabel: "Blue Team",
        defaultColor: "#3b82f6",
        defaultLogo: "/assets/teams/team_attackers.svg",
      },
      side2: {
        label: "ORANGE",
        fullLabel: "Orange Team",
        defaultColor: "#f97316",
        defaultLogo: "/assets/teams/team_defenders.svg",
      },
      hasHalftimeSideSwap: false,
    },
    maps: ["DFH Stadium", "Mannfield", "Champions Field", "Urban Central", "Utopia Coliseum"],
    scoring: {
      type: "goals_based",
      roundsToWinRegulation: 0,
      halfTimeAtRound: 0,
      overtimeTriggerScore: 0,
      winByTwoRequired: false,
      defaultTimeoutsPerTeam: 1,
    },
  },
  custom: {
    id: "custom",
    displayName: "Custom Match",
    category: "Tactical Shooter",
    defaultTournamentName: "VRGC Community Match",
    defaultSeriesFormat: "BO3",
    sides: {
      side1: {
        label: "TEAM 1",
        fullLabel: "Team 1",
        defaultColor: "#ff4655",
        defaultLogo: "/assets/teams/team_attackers.svg",
      },
      side2: {
        label: "TEAM 2",
        fullLabel: "Team 2",
        defaultColor: "#00f0ff",
        defaultLogo: "/assets/teams/team_defenders.svg",
      },
      hasHalftimeSideSwap: true,
    },
    maps: ["Arena 1", "Arena 2", "Arena 3"],
    scoring: {
      type: "round_based",
      roundsToWinRegulation: 13,
      halfTimeAtRound: 12,
      overtimeTriggerScore: 12,
      winByTwoRequired: true,
      defaultTimeoutsPerTeam: 2,
    },
  },
};

export const getGameProfile = (gameType?: string): GameProfile => {
  if (gameType && gameType in GAME_PROFILES) {
    return GAME_PROFILES[gameType as GameTypeId];
  }
  return VALORANT_PROFILE;
};
