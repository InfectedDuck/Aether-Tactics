export const fallbackBootstrap = {
  factions: [
    {
      id: "nomads",
      name: "Steppe Nomads",
      crest: "N",
      unlock: "Free",
      required_level_to_unlock: 1,
      lore: "Win by tempo, escape routes, and sudden board control.",
      passives: [
        { id: "open_roads", name: "Open Roads", icon: "OR", description: "If no capture is available, one normal piece may move one diagonal square backward." },
        { id: "dust_veil", name: "Dust Veil", icon: "DV", description: "After a quiet move, the moved piece blocks the first normal capture against it." },
      ],
      ultimates: [
        { id: "dash", name: "Dash", icon: "DS", cost: 2, description: "Move one normal piece exactly two diagonal empty squares. Dash cannot capture." },
        { id: "sandstorm_corridor", name: "Sandstorm", icon: "SC", cost: 2, description: "Block two empty dark squares from enemy quiet landings for one enemy turn." },
      ],
    },
    {
      id: "iron_guard",
      name: "Iron Guard",
      crest: "G",
      unlock: "Level 2",
      required_level_to_unlock: 2,
      lore: "Hold the center, survive attacks, and punish overextension.",
      passives: [
        { id: "shield_wall", name: "Shield Wall", icon: "SW", description: "The first allied piece that enters a highlighted playable center square becomes guarded for the enemy turn." },
        { id: "vengeance_ledger", name: "Vengeance Ledger", icon: "VL", description: "After losing a piece, your next capture grants one extra Momentum." },
      ],
      ultimates: [
        { id: "fortify", name: "Fortify", icon: "FT", cost: 2, description: "Choose one allied piece. For two enemy turns, that piece cannot be captured." },
        { id: "barricade", name: "Barricade", icon: "BR", cost: 2, description: "Place two temporary blockers on empty dark squares for one enemy turn." },
      ],
    },
    {
      id: "sun_court",
      name: "Sun Court",
      crest: "S",
      unlock: "Level 4",
      required_level_to_unlock: 4,
      lore: "Race for promotion and turn kings into pressure.",
      passives: [
        { id: "royal_pressure", name: "Royal Pressure", icon: "RP", description: "The first normal piece that enters the enemy final three rows grants Momentum." },
        { id: "crown_tax", name: "Crown Tax", icon: "CT", description: "The first time the opponent promotes a king, gain two Momentum." },
      ],
      ultimates: [
        { id: "crown_surge", name: "Crown Surge", icon: "CS", cost: 2, description: "Promote one normal piece in the middle rows immediately." },
        { id: "sun_lance", name: "Sun Lance", icon: "SL", cost: 2, description: "One normal piece strikes like a king for a diagonal capture this turn." },
      ],
    },
    {
      id: "void_order",
      name: "Void Order",
      crest: "V",
      unlock: "Vault Pass",
      required_level_to_unlock: 99,
      lore: "Disrupt lanes, mark mistakes, and bend board geometry.",
      passives: [
        { id: "pressure_field", name: "Pressure Field", icon: "PF", description: "Once per match, danger created by the opponent grants Momentum." },
        { id: "echo_mark", name: "Echo Mark", icon: "EM", description: "The first enemy quiet move is marked. Capture it for Momentum." },
      ],
      ultimates: [
        { id: "phase_shift", name: "Phase Shift", icon: "PS", cost: 2, description: "Teleport one normal piece up to 3 squares to any empty dark square, ignoring blockers." },
        { id: "collapse", name: "Collapse", icon: "CL", cost: 2, description: "Void one empty dark square so no piece may land there for one turn." },
      ],
    },
  ],
  campaign: {
    id: "nomads",
    name: "The Comeback Trail",
    levels: [
      { id: "road_behind", number: 1, name: "Open Road Escape", hook: "A scout has a safe retreat lane. The lesson is simple: Nomads can step backward before the enemy net closes.", objective: "Use Open Roads to retreat, watch Amber overextend, then finish the live board.", hint: "Select c3 and move backward to d2. Amber follows with d6-c5, then the campaign opens into free play.", clearMessage: "Open Roads proved the Nomads can retreat, reset the angle, and keep tempo.", aiLevel: "beginner", loadout: { factionId: "nomads", passiveId: "open_roads", ultimateId: "dash" }, completion: { type: "passive_move", id: "open_roads" }, white: ["a1", "c3", "e1", "g1"], black: ["b6", "d6", "f6", "h6", "a7"] },
      { id: "salt_road_sprint", number: 2, name: "Dash Raid", hook: "Amber left targets hanging around the center. A single rider can Dash into the pocket, bait a reply, and create a clean capture chain.", objective: "Use Dash to reach e3, let Amber step into the lane, then continue the capture chain before free play begins.", hint: "Press the ultimate, choose c1, Dash to e3, then capture e3xc5 and continue c5xa7.", clearMessage: "Dash inserted a rider behind the screen and opened a winning capture corridor.", aiLevel: "beginner", loadout: { factionId: "nomads", passiveId: "open_roads", ultimateId: "dash" }, completion: { type: "scripted_win", id: "dash_chain" }, white: ["a1", "c1", "g1", "h2"], black: ["b6", "c5", "g7", "h6"] },
      { id: "dust_trap", number: 3, name: "Dust Veil Bait", hook: "Amber has a capture ready on the center lane. Dust Veil absorbs the strike, then the Nomads punish with a forced chain.", objective: "Trigger Dust Veil, wait for the blocked e5xc3 jump, remove the main threat, then finish live play.", hint: "Move c3 to d4. After Dust Veil blocks e5xc3 over d4, capture d4xf6 and continue f6xh8. A final patrol remains after the showcase.", clearMessage: "Dust Veil protected the bait piece long enough to counter-capture the main Amber threat.", aiLevel: "beginner", loadout: { factionId: "nomads", passiveId: "dust_veil", ultimateId: "dash" }, completion: { type: "scripted_win", id: "dust_veil_chain" }, white: ["a1", "c3"], black: ["b6", "e5", "g7"] },
      { id: "storm_gate", number: 4, name: "Sandstorm Gate", hook: "Amber's f6 guard controls both exits. Sandstorm closes e5 and g5, then the Nomads turn the frozen lane into a capture chain.", objective: "Use Sandstorm Corridor on e5 and g5, break the gate, then finish live play.", hint: "Arm Sandstorm, block e5 and g5, then capture c3xe5 over d4 and continue e5xg7 over f6. A final patrol remains after the showcase.", clearMessage: "Sandstorm froze the guard long enough for a clean Nomad breakthrough.", aiLevel: "beginner", loadout: { factionId: "nomads", passiveId: "open_roads", ultimateId: "sandstorm_corridor" }, completion: { type: "scripted_win", id: "sandstorm_chain" }, white: ["a1", "c3"], black: ["b6", "d4", "f6"] },
      { id: "iron_first_wall", number: 5, factionId: "iron_guard", name: "Iron First Wall", hook: "The bastion has one clean center entry. Shield Wall turns that step into a protected anchor.", objective: "Trigger Shield Wall by moving an edge piece into the center.", hint: "Move b2 to c3. Shield Wall guards the center entry immediately.", clearMessage: "Shield Wall created a protected center anchor. The Iron Guard can now trade safely.", aiLevel: "beginner", aiPersonality: "iron_guard", loadout: { factionId: "iron_guard", passiveId: "shield_wall", ultimateId: "fortify" }, completion: { type: "passive_trigger", id: "shield_wall" }, white: ["b2", "d2", "f2", "h2"], black: ["a5", "c5", "e5", "g5"] },
      { id: "solar_crown_engine", number: 6, factionId: "sun_court", name: "Solar Crown Engine", hook: "A royal courier already reached mid-board. Crown Surge turns the piece into a king and opens a long diagonal capture.", objective: "Use Crown Surge on d4, watch the new king open a long diagonal, then finish the rival bot phase.", hint: "Arm Crown Surge, choose d4, then use the crowned king to capture d4xh8 over f6 before free play begins.", clearMessage: "Crown Surge made an instant king, opened a long capture angle, and flipped the race.", aiLevel: "beginner", aiPersonality: "sun_court", loadout: { factionId: "sun_court", passiveId: "royal_pressure", ultimateId: "crown_surge" }, completion: { type: "scripted_win", id: "crown_surge_chain" }, white: ["b2", "d4", "f2", "h2"], black: ["b6", "e7", "f6", "g7"] },
      { id: "void_first_shift", number: 7, factionId: "void_order", name: "Void First Shift", hook: "The archive corridor has one poisoned diagonal. Phase Shift moves a piece backward into an impossible pocket and opens the trap line.", objective: "Use Phase Shift from c3 to d2, cut through the trap line, then finish live play.", hint: "Arm Phase Shift, choose c3, land on d2, then capture d2xf4 over e3 and continue f4xh6 over g5. A final patrol remains after the showcase.", clearMessage: "Phase Shift bent the geometry into a winning capture chain.", aiLevel: "beginner", aiPersonality: "void_order", loadout: { factionId: "void_order", passiveId: "pressure_field", ultimateId: "phase_shift" }, completion: { type: "scripted_win", id: "phase_shift_chain" }, white: ["a1", "c3"], black: ["b6", "e3", "g5"] },
    ],
  },
  leaderboard: [
    { id: "seed-almaty-1", name: "Aruzhan", city: "Almaty", wins: 18, losses: 5, captures: 71, puzzles: 9 },
    { id: "seed-almaty-2", name: "Daniyar", city: "Almaty", wins: 13, losses: 4, captures: 52, puzzles: 7 },
  ],
};
