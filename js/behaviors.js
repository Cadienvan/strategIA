class Behavior {
  constructor(type, description) {
    this.type = type;
    this.description = description;
  }

  // Base method to adjust AI decision-making weights
  getActionWeights(gameState) {
    // Default implementation with balanced weights
    return {
      upgradeCity: 1.0,
      buyUnit: 1.0,
      moveUnit: 1.0,
      attackUnit: 1.0,
      foundCity: 1.0,
      conquerCity: 1.0,
    };
  }

  // Base method to modify unit purchase preferences
  getUnitPreferences(gameState) {
    // Default implementation with balanced unit preferences
    return {
      soldier: 1.0,
      knight: 1.0,
      giant: 1.0,
      dragon: 1.0,
      colonizer: 1.0
    };
  }
}

class DefenderBehavior extends Behavior {
  constructor() {
    super('Defender', 'Focuses on city defense and upgrading, prefers defensive units');
  }

  getActionWeights(gameState) {
    return {
      upgradeCity: 2.0,     // High focus on upgrading cities
      buyUnit: 1.5,         // Good focus on unit production
      moveUnit: 0.5,        // Less emphasis on movement
      attackUnit: 0.3,      // Rarely attacks
      foundCity: 0.7,       // Less focus on expansion
      conquerCity: 0.2      // Avoids conquering cities
    };
  }

  getUnitPreferences(gameState) {
    return {
      soldier: 1.5,         // Likes soldiers for defense
      knight: 1.0,          // Average knights
      giant: 2.0,           // Prefers giants (high HP)
      dragon: 1.0,          // Average dragons
      colonizer: 0.5        // Low focus on colonizers
    };
  }
}

class WarriorBehavior extends Behavior {
  constructor() {
    super('Warrior', 'Focuses on military might, prefers offensive units and conquest');
  }

  getActionWeights(gameState) {
    return {
      upgradeCity: 0.5,     // Low focus on upgrading cities
      buyUnit: 2.0,         // High focus on unit production
      moveUnit: 1.5,        // Emphasizes movement
      attackUnit: 2.0,      // Strongly prefers attacking
      foundCity: 0.5,       // Low focus on founding new cities
      conquerCity: 2.0      // Strongly prefers conquest
    };
  }

  getUnitPreferences(gameState) {
    return {
      soldier: 1.2,         // Likes soldiers
      knight: 2.0,          // Prefers knights (high attack)
      giant: 1.0,           // Average giants
      dragon: 2.0,          // Strongly prefers dragons
      colonizer: 0.3        // Rarely uses colonizers
    };
  }
}

class ExpansionistBehavior extends Behavior {
  constructor() {
    super('Expansionist', 'Focuses on rapidly expanding territory through colonization');
  }

  getActionWeights(gameState) {
    return {
      upgradeCity: 0.7,     // Below average focus on upgrading
      buyUnit: 1.0,         // Average unit production
      moveUnit: 1.3,        // Above average movement
      attackUnit: 0.5,      // Below average attacking
      foundCity: 2.0,       // High focus on founding cities
      conquerCity: 1.0      // Average conquest
    };
  }

  getUnitPreferences(gameState) {
    return {
      soldier: 0.7,         // Below average soldiers
      knight: 0.7,          // Below average knights
      giant: 0.5,           // Rarely uses giants
      dragon: 0.5,          // Rarely uses dragons
      colonizer: 2.0        // Strong preference for colonizers
    };
  }
}

class EconomistBehavior extends Behavior {
  constructor() {
    super('Economist', 'Focuses on city development and economic growth');
  }

  getActionWeights(gameState) {
    return {
      upgradeCity: 2.0,     // High focus on upgrading cities
      buyUnit: 0.7,         // Below average unit production
      moveUnit: 0.7,        // Below average movement
      attackUnit: 0.3,      // Rarely attacks
      foundCity: 1.5,       // Above average city founding
      conquerCity: 0.3      // Rarely conquers cities
    };
  }

  getUnitPreferences(gameState) {
    return {
      soldier: 0.5,         // Rarely uses soldiers
      knight: 0.5,          // Rarely uses knights
      giant: 0.5,           // Rarely uses giants
      dragon: 0.3,          // Very rarely uses dragons
      colonizer: 1.8        // Strong preference for colonizers
    };
  }
}

class BalancedBehavior extends Behavior {
  constructor() {
    super('Balanced', 'Takes a balanced approach to all aspects of the game');
  }

  // Uses the default implementation from the base class
  // which already has balanced weights
}

// Factory method to create a behavior by type
function createBehavior(type) {
  switch(type.toLowerCase()) {
    case 'defender':
      return new DefenderBehavior();
    case 'warrior':
      return new WarriorBehavior();
    case 'expansionist':
      return new ExpansionistBehavior();
    case 'economist':
      return new EconomistBehavior();
    case 'balanced':
    default:
      return new BalancedBehavior();
  }
}

// List of all available behavior types
const BEHAVIOR_TYPES = ['Defender', 'Warrior', 'Expansionist', 'Economist', 'Balanced'];
