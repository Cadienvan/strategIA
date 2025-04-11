const Utils = {
  generateRandomName: () => {
    const prefixes = ['Great', 'Mighty', 'Ancient', 'Heroic', 'Golden', 'Iron', 'Silver', 'Bronze'];
    const names = ['Kingdom', 'Empire', 'Realm', 'Dynasty', 'Nation', 'Dominion', 'Republic', 'Clan'];
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
  },

  generateRandomColor: () => {
    // Expanded color palette with distinct colors and their territory versions
    const colors = [
      { color: '#FF4136', territoryColor: '#FFCBC8' }, // Red
      { color: '#0074D9', territoryColor: '#B3D9FF' }, // Blue
      { color: '#2ECC40', territoryColor: '#C1F2C7' }, // Green
      { color: '#FFDC00', territoryColor: '#FFF4B3' }, // Yellow
      { color: '#B10DC9', territoryColor: '#E9B3F0' }, // Purple
      { color: '#FF851B', territoryColor: '#FFDCB3' }, // Orange
      { color: '#7FDBFF', territoryColor: '#D9F5FF' }, // Light Blue
      { color: '#F012BE', territoryColor: '#FABCEF' }, // Magenta
      { color: '#01FF70', territoryColor: '#B3FFCB' }, // Lime
      { color: '#39CCCC', territoryColor: '#C1EEEE' }, // Teal
      { color: '#85144b', territoryColor: '#DEB0C3' }, // Maroon
      { color: '#3D9970', territoryColor: '#C1DFD0' }, // Olive
      // Additional colors to ensure uniqueness for larger games
      { color: '#6B5B95', territoryColor: '#D8D1E6' }, // Royal Purple
      { color: '#88B04B', territoryColor: '#DDE6C8' }, // Greenery
      { color: '#F7CAC9', territoryColor: '#FCE9E9' }, // Rose Quartz
      { color: '#92A8D1', territoryColor: '#DEE5F2' }, // Serenity
      { color: '#955251', territoryColor: '#DDCACA' }, // Marsala
      { color: '#B565A7', territoryColor: '#EBD0E4' }, // Radiant Orchid
      { color: '#009B77', territoryColor: '#B3E5DC' }, // Emerald
      { color: '#DD4124', territoryColor: '#F6C8BD' }, // Tangerine Tango
      { color: '#D65076', territoryColor: '#F3CAD7' }, // Honeysuckle
      { color: '#45B8AC', territoryColor: '#C8ECE8' }, // Turquoise
      { color: '#EFC050', territoryColor: '#F9E7C8' }, // Mimosa
      { color: '#5B5EA6', territoryColor: '#CDCEE7' }  // Blue Iris
    ];
    
    // Used colors tracking is handled in Game class
    return colors;
  },

  // track used colors to ensure uniqueness
  usedColorIndices: [],
  
  // Get a unique color that hasn't been used yet
  getUniqueColor: function() {
    const allColors = this.generateRandomColor();
    
    // If all colors have been used, reset the tracking
    if (this.usedColorIndices.length >= allColors.length) {
      this.usedColorIndices = [];
    }
    
    // Find an unused color index
    let colorIndex;
    do {
      colorIndex = Math.floor(Math.random() * allColors.length);
    } while (this.usedColorIndices.includes(colorIndex));
    
    // Mark this color as used
    this.usedColorIndices.push(colorIndex);
    
    return allColors[colorIndex];
  },

  getRandomPosition: (width, height, minDistance, existingPositions) => {
    let x, y, isValid;
    do {
      isValid = true;
      x = Math.floor(Math.random() * width);
      y = Math.floor(Math.random() * height);

      for (const pos of existingPositions) {
        const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
        if (distance < minDistance) {
          isValid = false;
          break;
        }
      }
    } while (!isValid);

    return { x, y };
  },

  calculateScore: (player) => {
    return (player.territorySize * 10) +
           (player.units.filter(u => u.type === 'soldier').length * 1) +
           (player.units.filter(u => u.type === 'knight').length * 2) +
           (player.units.filter(u => u.type === 'giant').length * 3) +
           (player.units.filter(u => u.type === 'dragon').length * 5);
  },
  
  // Add validation helper for city placement distance
  validateCityPlacement: (x, y, gameInstance) => {
    // Check distance from all existing cities
    for (const player of gameInstance.players) {
      for (const city of player.cities) {
        // Use max of x,y distance (Chebyshev distance)
        const distance = Math.max(Math.abs(city.x - x), Math.abs(city.y - y));
        
        if (distance < 2) {
          console.error(`Cannot found city: Too close to existing city at (${city.x}, ${city.y})`);
          return { valid: false, reason: "New cities must be at least 2 squares away from existing cities" };
        }
      }
    }
    
    return { valid: true };
  },
  
  // Update existing validation helper for city founding
  validateFoundCityAction: (unit, gameInstance) => {
    if (!unit) {
      console.error("Cannot found city: Unit does not exist");
      return { valid: false, reason: "Unit does not exist" };
    }
    
    if (unit.type !== 'colonizer') {
      console.error(`Cannot found city: Unit type ${unit.type} is not a colonizer`);
      return { valid: false, reason: `Only colonizers can found cities, but unit is a ${unit.type}` };
    }
    
    if (unit.hasMoved) {
      console.error("Cannot found city: Colonizer has already moved this turn");
      return { valid: false, reason: "Colonizer has already moved this turn" };
    }
    
    if (unit.hasPerformedAction) {
      console.error("Cannot found city: Colonizer has already performed an action this turn");
      return { valid: false, reason: "Colonizer has already performed an action this turn" };
    }
    
    // Add check for minimum distance from other cities
    const cityPlacementValidation = Utils.validateCityPlacement(unit.x, unit.y, gameInstance);
    if (!cityPlacementValidation.valid) {
      return cityPlacementValidation;
    }
    
    return { valid: true };
  }
};
