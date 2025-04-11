class Unit {
  static nextId = 1;

  constructor(x, y, player, type) {
    this.id = Unit.nextId++;
    this.x = x;
    this.y = y;
    this.player = player;
    this.type = type.toLowerCase(); // Normalize type to lowercase to avoid case sensitivity issues
    this.hasMoved = false;
    this.hasAttacked = false;
    this.hasPerformedAction = false;

    const stats = {
      soldier: { cost: 3, hp: 5, atk: 2, movement: 1, symbol: 'S' },
      knight: { cost: 7, hp: 8, atk: 4, movement: 2, symbol: 'K' },
      giant: { cost: 12, hp: 30, atk: 3, movement: 1, symbol: 'O' },
      dragon: { cost: 30, hp: 25, atk: 7, movement: 3, symbol: 'D' },
      colonizer: { cost: 10, hp: 3, atk: 1, movement: 1, symbol: 'C' }
    };

    // Check if the unit type exists in our stats
    if (!stats[this.type]) {
      console.error(`Unknown unit type: ${this.type}, defaulting to soldier`);
      this.type = 'soldier';
    }

    const unitStats = stats[this.type];
    console.log(`Creating unit of type ${this.type} with stats:`, unitStats);
    
    this.hp = unitStats.hp;
    this.maxHp = unitStats.hp;
    this.atk = unitStats.atk;
    this.movement = unitStats.movement;
    this.cost = unitStats.cost;
    this.symbol = unitStats.symbol;
  }

  canMoveTo(x, y, game) {
    if (this.hasMoved) {
      console.log('Unit has already moved this turn');
      return false;
    }
    
    const dx = x - this.x;
    const dy = y - this.y;
    
    // Use Chebyshev distance for ALL units (max of x,y distance)
    // This enables full diagonal movement for all unit types
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    
    console.log(`Unit ${this.type} with movement ${this.movement}, trying to move distance ${distance}`);
    
    if (distance > this.movement) {
      console.log('Distance too far for unit movement');
      return false;
    }
    
    // Check if the destination has a unit
    if (game.getUnitAt(x, y)) {
      console.log('Destination has a unit');
      return false;
    }
    
    // Check if the destination has a city
    // Allow movement onto enemy cities, but not friendly cities
    const city = game.getCityAt(x, y);
    if (city && city.player === this.player) {
      console.log('Destination has a friendly city');
      return false;
    }
    
    return true;
  }
  
  canAttack(unit) {
    if (this.hasAttacked) {
      console.log('Unit has already attacked this turn');
      return false;
    }
    
    // Use Euclidean distance for attack range
    const dx = unit.x - this.x;
    const dy = unit.y - this.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Units can attack adjacent cells (distance <= 1.5 to handle diagonal)
    return distance <= 1.5;
  }

  move(x, y) {
    this.x = x;
    this.y = y;
    this.hasMoved = true;
  }

  attack(target) {
    if (this.hasAttacked) return false;
    
    console.log(`${this.type} attacks for ${this.atk} damage`);
    target.hp -= this.atk;
    console.log(`Target HP reduced to ${target.hp}/${target.maxHp}`);
    
    this.hasAttacked = true;
    
    return target.hp <= 0;
  }

  resetTurn() {
    this.hasMoved = false;
    this.hasAttacked = false;
    this.hasPerformedAction = false;
  }

  canFoundCity() {
    // Check basic conditions first
    if (this.type !== 'colonizer' || this.hasPerformedAction || this.hasMoved) {
      return false;
    }
    
    // Check if there's already a city at this location
    if (this.player.game && this.player.game.getCityAt(this.x, this.y)) {
      return false;
    }
    
    // Check distance from other cities
    if (this.player.game) {
      for (const player of this.player.game.players) {
        for (const city of player.cities) {
          // Use Chebyshev distance (max of x,y distance)
          const distance = Math.max(Math.abs(city.x - this.x), Math.abs(city.y - this.y));
          if (distance < 3) {
            return false; // Too close to an existing city
          }
        }
      }
    }
    
    return true;
  }

  foundCity(game) {
    if (!this.canFoundCity()) return false;
    
    // Check if the city placement is valid
    const cityPlacementValidation = Utils.validateCityPlacement(this.x, this.y, game);
    if (!cityPlacementValidation.valid) {
      console.error(`Cannot found city: ${cityPlacementValidation.reason}`);
      return false;
    }

    // Create a new city at the colonizer's position
    const city = new City(this.x, this.y, this.player);
    this.player.addCity(city);
    
    // Remove the colonizer unit
    this.player.removeUnit(this);
    game.removeUnit(this);
    
    return true;
  }

  canConquerCity() {
    return !this.hasMoved && !this.hasAttacked && !this.hasPerformedAction;
  }

  conquerCity(city, game) {
    if (!this.canConquerCity()) return false;

    // Store old owner for elimination check
    const oldOwner = city.player;
    
    // Remove city from old owner's cities
    const cityIndex = oldOwner.cities.indexOf(city);
    if (cityIndex !== -1) {
      oldOwner.cities.splice(cityIndex, 1);
    }
    
    // Reduce city level (minimum 1)
    if (city.level > 1) {
      city.level--;
    }
    
    // Transfer city ownership to this unit's player
    city.player = this.player;
    this.player.addCity(city);
    
    // Recalculate territory for the city
    city.calculateTerritory();
    
    // Mark action as performed
    this.hasPerformedAction = true;
    
    // Check if old owner has been eliminated
    if (oldOwner.cities.length === 0) {
      game.eliminatePlayer(oldOwner);
    }
    
    return true;
  }

  static getCost(type) {
    const costs = {
      soldier: 3,
      knight: 7,
      giant: 12,
      dragon: 30,
      colonizer: 10
    };
    
    // Normalize type to lowercase
    const normalizedType = type.toLowerCase();
    if (!costs[normalizedType]) {
      console.error(`Unknown unit type cost for: ${type}, defaulting to soldier cost`);
      return costs.soldier;
    }
    
    return costs[normalizedType];
  }
}
