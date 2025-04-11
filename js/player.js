class Player {
  constructor(id, behavior = null, colorSet = null) {
    this.id = id;
    this.name = Utils.generateRandomName();
    
    // Use provided colorSet or generate a new one
    if (colorSet) {
      this.color = colorSet.color;
      this.territoryColor = colorSet.territoryColor;
    } else {
      // Get both color and territoryColor
      const generatedColorSet = Utils.generateRandomColor();
      this.color = generatedColorSet.color;
      this.territoryColor = generatedColorSet.territoryColor;
    }
    
    this.coins = 10;
    this.cities = [];
    this.units = [];
    this.territorySize = 0;
    this.isActive = false;
    
    // Assign behavior (defaults to Balanced if not specified)
    this.behavior = behavior || createBehavior('Balanced');
    
    // Append behavior type to player name
    this.name += ` (${this.behavior.type})`;
    
    // Initialize diplomacy system
    this.diplomacy = new Diplomacy(this);
  }

  addCity(city) {
    this.cities.push(city);
    this.updateTerritorySize();
  }

  addUnit(unit) {
    this.units.push(unit);
  }

  removeUnit(unit) {
    const index = this.units.indexOf(unit);
    if (index !== -1) {
      this.units.splice(index, 1);
    }
  }

  updateTerritorySize() {
    // Will be calculated based on cities and their territory
    this.territorySize = this.cities.reduce((total, city) => {
      return total + city.territorySize;
    }, 0);
  }

  collectIncome() {
    let income = this.cities.reduce((total, city) => {
      return total + city.level;
    }, 0);
    
    // Add income from peace treaties
    if (this.diplomacy && this.diplomacy.peaceTreaties) {
      for (const treaty of this.diplomacy.peaceTreaties) {
        income += treaty.bonusCoins;
      }
    }
    
    this.coins += income;
    return income;
  }

  canAfford(cost) {
    return this.coins >= cost;
  }

  spend(amount) {
    if (this.canAfford(amount)) {
      this.coins -= amount;
      return true;
    }
    return false;
  }

  getScore() {
    return Utils.calculateScore(this);
  }
}

// New class to handle diplomatic relations
class Diplomacy {
  constructor(player) {
    this.player = player;
    this.favorMap = new Map();  // Maps player IDs to favor values
    this.peaceTreaties = [];    // Array of {playerId, turnsActive, bonusCoins}
    this.wars = [];             // Array of {playerId, turnsRemaining}
    this.pendingTreaties = [];  // Array of player IDs who have proposed treaties
  }
  
  initializeRelations(players) {
    for (const player of players) {
      if (player.id !== this.player.id) {
        this.favorMap.set(player.id, 0);  // Start with neutral favor
      }
    }
  }
  
  // Favor management
  changeFavor(playerId, amount) {
    const currentFavor = this.getFavor(playerId);
    this.favorMap.set(playerId, Math.max(-100, Math.min(100, currentFavor + amount)));
    return this.getFavor(playerId);
  }
  
  getFavor(playerId) {
    return this.favorMap.get(playerId) || 0;
  }
  
  // Peace treaty management
  proposePeaceTreaty(playerId) {
    if (!this.pendingTreaties.includes(playerId)) {
      this.pendingTreaties.push(playerId);
      return true;
    }
    return false;
  }
  
  acceptPeaceTreaty(playerId) {
    // Remove from pending treaties
    const index = this.pendingTreaties.indexOf(playerId);
    if (index !== -1) {
      this.pendingTreaties.splice(index, 1);
      
      // Create new peace treaty
      this.peaceTreaties.push({
        playerId: playerId,
        turnsActive: 0,
        bonusCoins: 2  // Each treaty provides 2 coins per turn
      });
      
      // Increase favor
      this.changeFavor(playerId, 20);
      
      return true;
    }
    return false;
  }
  
  rejectPeaceTreaty(playerId) {
    const index = this.pendingTreaties.indexOf(playerId);
    if (index !== -1) {
      this.pendingTreaties.splice(index, 1);
      
      // Decrease favor slightly
      this.changeFavor(playerId, -10);
      
      return true;
    }
    return false;
  }
  
  hasPeaceTreaty(playerId) {
    return this.peaceTreaties.some(treaty => treaty.playerId === playerId);
  }
  
  breakPeaceTreaty(playerId) {
    const index = this.peaceTreaties.findIndex(treaty => treaty.playerId === playerId);
    if (index !== -1) {
      this.peaceTreaties.splice(index, 1);
      
      // Lose ALL favor with this player
      this.favorMap.set(playerId, -100);
      
      // Lose some favor with all other players (treaty breaking is frowned upon)
      for (const [pid, favor] of this.favorMap.entries()) {
        if (pid !== playerId) {
          this.changeFavor(pid, -15);
        }
      }
      
      return true;
    }
    return false;
  }
  
  // War management
  declareWar(playerId) {
    // First break any existing peace treaty
    if (this.hasPeaceTreaty(playerId)) {
      this.breakPeaceTreaty(playerId);
    }
    
    // Then declare war
    if (!this.isAtWar(playerId)) {
      this.wars.push({
        playerId: playerId,
        turnsRemaining: 10  // 10 turns until peace is possible
      });
      
      // Set favor to very negative
      this.favorMap.set(playerId, -100);
      
      return true;
    }
    return false;
  }
  
  isAtWar(playerId) {
    return this.wars.some(war => war.playerId === playerId);
  }
  
  getWarWith(playerId) {
    return this.wars.find(war => war.playerId === playerId);
  }
  
  proposePeace(playerId) {
    if (this.isAtWar(playerId)) {
      const war = this.getWarWith(playerId);
      if (war && war.turnsRemaining <= 0) {
        this.proposePeaceTreaty(playerId);
        return true;
      }
    }
    return false;
  }
  
  // Turn handling for diplomacy
  processTurn() {
    // Update treaty turns
    for (const treaty of this.peaceTreaties) {
      treaty.turnsActive++;
    }
    
    // Count down war turns
    for (const war of this.wars) {
      if (war.turnsRemaining > 0) {
        war.turnsRemaining--;
      }
    }
  }
}
