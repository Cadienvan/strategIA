class City {
  static nextId = 1;

  constructor(x, y, player) {
    this.id = City.nextId++;
    this.x = x;
    this.y = y;
    this.player = player;
    this.level = 1;
    this.population = 10;
    this.range = 1; // Initial range
    this.territorySize = 1;
    this.territory = [];
    this.updateRange(); // Set initial range
    this.calculateTerritory();
  }

  calculateTerritory() {
    this.territory = [];
    const range = this.range;
    
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (dx === 0 && dy === 0) continue;  // Skip the city itself
        
        const tx = this.x + dx;
        const ty = this.y + dy;
        
        // Check if within game bounds (will be validated by game)
        this.territory.push({ x: tx, y: ty, level: this.level });
      }
    }
    
    this.territorySize = this.territory.length + 1; // +1 for the city itself
  }

  upgrade() {
    const cost = this.getUpgradeCost();
    
    if (this.player.canAfford(cost) && this.player.spend(cost)) {
      this.level++;
      this.population += 10;
      this.updateRange();
      this.calculateTerritory();
      return true;
    }
    return false;
  }

  updateRange() {
    // Range only increases at levels 4, 7, and 10
    if (this.level === 4) {
      this.range = 2;
    } else if (this.level === 7) {
      this.range = 3;
    } else if (this.level === 10) {
      this.range = 4;
    }
  }

  getUpgradeCost() {
    return this.level * 50;
  }

  getIncome() {
    return Math.floor(this.population / 10) * 10;
  }
}
