class Game {
  constructor() {
    this.mapSize = 100;
    this.playerCount = 8;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.currentTurn = 1;
    this.units = [];
    this.ui = null;
    this.hasPurchasedUnitThisTurn = false;
    this.eliminatedPlayers = [];
    this.agentMode = false;
    this.agent = null;
    this.isProcessingAITurn = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('startGame').addEventListener('click', () => {
      this.mapSize = parseInt(document.getElementById('mapSize').value);
      this.playerCount = parseInt(document.getElementById('playerCount').value);
      this.agentMode = document.getElementById('agentModeEnabled').checked;
      this.startGame();
    });

    document.getElementById('endTurn').addEventListener('click', () => {
      this.nextTurn();
    });
  }

  startGame() {
    document.getElementById('gameSetupControls').style.display = 'none';
    document.getElementById('gameTurnControls').style.display = 'flex';
    
    this.createPlayers();
    this.spawnInitialCities();
    this.currentPlayerIndex = 0;
    this.currentTurn = 1;
    this.players[this.currentPlayerIndex].isActive = true;
    
    if (this.agentMode) {
      this.agent = new Agent(this);
      
      // Show agent chat section when in agent mode
      const chatContainer = document.getElementById('agentChatContainer');
      if (chatContainer) {
        chatContainer.style.display = 'block';
      }
    } else {
      // Hide agent chat section when not in agent mode
      const chatContainer = document.getElementById('agentChatContainer');
      if (chatContainer) {
        chatContainer.style.display = 'none';
      }
    }
    
    this.ui = new UI(this);
    this.ui.render();
    this.updateRankings();
    
    this.initializeDiplomacy();
    
    // If in agent mode, start AI processing
    if (this.agentMode) {
      this.processAITurn();
    }
  }

  initializeDiplomacy() {
    // Initialize diplomatic relations between all players
    for (const player of this.players) {
      player.diplomacy.initializeRelations(this.players);
    }
  }

  createPlayers() {
    this.players = [];
    
    // Create an array of all behavior types and shuffle it
    const behaviors = [...BEHAVIOR_TYPES];
    this.shuffleArray(behaviors);
    
    for (let i = 0; i < this.playerCount; i++) {
      // Assign behaviors sequentially from the shuffled array
      // If we have more players than behaviors, we'll start repeating
      const behaviorType = behaviors[i % behaviors.length];
      const behavior = createBehavior(behaviorType);
      
      // Use unique color for each player
      this.players.push(new Player(i, behavior, Utils.getUniqueColor()));
    }
  }
  
  // Utility method to shuffle an array
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  spawnInitialCities() {
    const existingPositions = [];
    
    for (const player of this.players) {
      // Place each player's initial city with minimum distance between them
      const position = Utils.getRandomPosition(this.mapSize, this.mapSize, 3, existingPositions);
      existingPositions.push(position);
      
      const city = new City(position.x, position.y, player);
      player.addCity(city);
    }
  }

  getUnitAt(x, y) {
    return this.units.find(unit => unit.x === x && unit.y === y);
  }

  getCityAt(x, y) {
    for (const player of this.players) {
      const city = player.cities.find(city => city.x === x && city.y === y);
      if (city) return city;
    }
    return null;
  }

  removeUnit(unit) {
    const index = this.units.indexOf(unit);
    if (index !== -1) {
      this.units.splice(index, 1);
    }
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextTurn() {
    // Skip eliminated players
    if (this.players.length <= 1) return;

    this.currentPlayer.isActive = false;
    
    // Process diplomacy for current player before moving to next
    if (this.currentPlayer.diplomacy) {
      this.currentPlayer.diplomacy.processTurn();
    }
    
    // Clear any pending AI actions from the previous player
    if (this.agentMode && this.agent) {
      this.agent.clearPendingActions();
    }
    
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
    
    // If we've gone through all players, advance to next turn
    if (this.currentPlayerIndex === 0) {
      this.currentTurn++;
      
      // Process territorial violations and update favor
      this.processDiplomaticEvents();
      
      // Collect income for all players at the start of a new turn
      for (const player of this.players) {
        player.collectIncome();
      }
    }
    
    this.currentPlayer.isActive = true;
    this.hasPurchasedUnitThisTurn = false;
    
    // Reset unit movement/attack status for the current player
    for (const unit of this.currentPlayer.units) {
      unit.resetTurn();
    }
    
    // Update UI
    if (this.ui) {
      this.ui.selectedEntity = null;
      this.ui.hideActionPanel();
      this.ui.render();
    }
    
    this.updateRankings();
    
    // If in agent mode, process AI turn
    if (this.agentMode) {
      this.processAITurn();
    }
  }

  processDiplomaticEvents() {
    // Check for territorial violations and update favor
    for (const player of this.players) {
      // Create a map of player territories
      const territories = this.getPlayerTerritories();
      
      for (const otherPlayer of this.players) {
        if (player.id === otherPlayer.id) continue;
        
        // Skip favor changes if players are at war
        if (player.diplomacy.isAtWar(otherPlayer.id)) continue;
        
        let territoryViolation = false;
        let borderViolation = false;
        
        // Check if any of otherPlayer's units are in player's territory
        for (const unit of otherPlayer.units) {
          const terrOwner = territories.get(`${unit.x},${unit.y}`);
          
          // Check for territory violation
          if (terrOwner === player.id) {
            territoryViolation = true;
          } else {
            // Check for border violation (1 square from territory)
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const checkX = unit.x + dx;
                const checkY = unit.y + dy;
                const checkOwner = territories.get(`${checkX},${checkY}`);
                if (checkOwner === player.id) {
                  borderViolation = true;
                }
              }
            }
          }
        }
        
        // Update favor based on violations
        if (territoryViolation) {
          player.diplomacy.changeFavor(otherPlayer.id, -10);
        } else if (borderViolation) {
          player.diplomacy.changeFavor(otherPlayer.id, -5);
        } else {
          // Small favor boost for respecting boundaries
          player.diplomacy.changeFavor(otherPlayer.id, 1);
        }
      }
    }
  }
  
  getPlayerTerritories() {
    // Create a map of positions to player IDs
    const territories = new Map();
    
    for (const player of this.players) {
      for (const city of player.cities) {
        // The city cell itself
        territories.set(`${city.x},${city.y}`, player.id);
        
        // City territory
        for (const tile of city.territory) {
          territories.set(`${tile.x},${tile.y}`, player.id);
        }
      }
    }
    
    return territories;
  }
  
  // Diplomacy action methods
  proposePeaceTreaty(fromPlayerId, toPlayerId) {
    const fromPlayer = this.players.find(p => p.id === fromPlayerId);
    const toPlayer = this.players.find(p => p.id === toPlayerId);
    
    if (fromPlayer && toPlayer && fromPlayer.diplomacy && toPlayer.diplomacy) {
      if (!fromPlayer.diplomacy.hasPeaceTreaty(toPlayerId) && 
          !fromPlayer.diplomacy.isAtWar(toPlayerId)) {
        return toPlayer.diplomacy.proposePeaceTreaty(fromPlayerId);
      }
    }
    return false;
  }
  
  acceptPeaceTreaty(fromPlayerId, toPlayerId) {
    const fromPlayer = this.players.find(p => p.id === fromPlayerId);
    const toPlayer = this.players.find(p => p.id === toPlayerId);
    
    if (fromPlayer && toPlayer && fromPlayer.diplomacy && toPlayer.diplomacy) {
      // Both players need to set up the treaty
      const fromAccepted = fromPlayer.diplomacy.acceptPeaceTreaty(toPlayerId);
      const toAccepted = toPlayer.diplomacy.acceptPeaceTreaty(fromPlayerId);
      
      return fromAccepted && toAccepted;
    }
    return false;
  }
  
  rejectPeaceTreaty(fromPlayerId, toPlayerId) {
    const toPlayer = this.players.find(p => p.id === toPlayerId);
    
    if (toPlayer && toPlayer.diplomacy) {
      return toPlayer.diplomacy.rejectPeaceTreaty(fromPlayerId);
    }
    return false;
  }
  
  breakPeaceTreaty(fromPlayerId, toPlayerId) {
    const fromPlayer = this.players.find(p => p.id === fromPlayerId);
    const toPlayer = this.players.find(p => p.id === toPlayerId);
    
    if (fromPlayer && toPlayer && fromPlayer.diplomacy && toPlayer.diplomacy) {
      // Break from both sides
      fromPlayer.diplomacy.breakPeaceTreaty(toPlayerId);
      toPlayer.diplomacy.breakPeaceTreaty(fromPlayerId);
      
      return true;
    }
    return false;
  }
  
  declareWar(fromPlayerId, toPlayerId) {
    const fromPlayer = this.players.find(p => p.id === fromPlayerId);
    const toPlayer = this.players.find(p => p.id === toPlayerId);
    
    if (fromPlayer && toPlayer && fromPlayer.diplomacy && toPlayer.diplomacy) {
      // Declare war from both sides
      fromPlayer.diplomacy.declareWar(toPlayerId);
      toPlayer.diplomacy.declareWar(fromPlayerId);
      
      return true;
    }
    return false;
  }
  
  proposePeace(fromPlayerId, toPlayerId) {
    const fromPlayer = this.players.find(p => p.id === fromPlayerId);
    
    if (fromPlayer && fromPlayer.diplomacy) {
      return fromPlayer.diplomacy.proposePeace(toPlayerId);
    }
    return false;
  }

  updateRankings() {
    // Recalculate territory size for all players
    for (const player of this.players) {
      player.updateTerritorySize();
    }
    
    if (this.ui) {
      this.ui.updateRankings();
    }
  }

  eliminatePlayer(player) {
    console.log(`Player ${player.name} has been eliminated!`);
    
    // Add to eliminated players list
    this.eliminatedPlayers.push(player);
    
    // Remove all units of the eliminated player
    for (const unit of [...player.units]) {
      this.removeUnit(unit);
      player.removeUnit(unit);
    }
    
    // Adjust current player index if needed
    if (this.players.indexOf(player) < this.currentPlayerIndex) {
      this.currentPlayerIndex--;
    }
    
    // Remove player from active players list
    const index = this.players.indexOf(player);
    if (index !== -1) {
      this.players.splice(index, 1);
    }
    
    // If only one player remains, they win
    if (this.players.length === 1) {
      this.endGame(this.players[0]);
    }
    
    // Update display
    if (this.ui) {
      this.ui.showMessage(`${player.name} has been eliminated!`);
    }
  }

  endGame(winner) {
    console.log(`Game over! ${winner.name} is the winner!`);
    
    const gameInfo = document.getElementById('gameInfo');
    if (gameInfo) {
      gameInfo.innerHTML = `<div class="game-over">
        <h2>Game Over!</h2>
        <p>${winner.name} is the winner!</p>
        <button id="newGame">New Game</button>
      </div>`;
      
      document.getElementById('newGame').addEventListener('click', () => {
        location.reload();
      });
    }
    
    // Disable end turn button
    const endTurnBtn = document.getElementById('endTurn');
    if (endTurnBtn) {
      endTurnBtn.disabled = true;
    }
  }

  async processAITurn() {
    if (!this.agentMode || this.players.length <= 1) return;
    
    this.isProcessingAITurn = true;
    
    // Update UI to show thinking state
    if (this.ui) {
      this.ui.updateThinkingState(true);
    }
    
    try {
      // Process one action at a time until an endTurn action is received
      let continueProcessing = true;
      
      while (continueProcessing && this.players.length > 1) {
        // Get AI action for current player
        const action = await this.agent.getAction(this.currentPlayer);
        
        if (!action) {
          continueProcessing = false;
        } else if (action.action === "endTurn") {
          continueProcessing = false;
        } else {
          // Execute the action
          await this.executeAIAction(action);
          
          // Short delay between actions to make them visible to the user
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Update the UI after each action
          if (this.ui) {
            this.ui.render();
          }
        }
      }
      
      // Move to next turn once all actions are complete
      if (this.players.length > 1) {
        this.nextTurn();
      }
    } catch (error) {
      console.error("Error processing AI turn:", error);
      // Move to next turn if there's an error
      this.nextTurn();
    } finally {
      this.isProcessingAITurn = false;
      if (this.ui) {
        this.ui.updateThinkingState(false);
      }
    }
  }

  async executeAIAction(action) {
    // Check if action is properly defined
    if (!action || typeof action !== 'object') {
      console.warn('Received invalid AI action:', action);
      return;
    }
    
    const actionName = action.action || 'unknown';
    const parameters = action.parameters || {};
    
    console.log(`Executing AI action: ${actionName}`, parameters);

    // Validate that the action is currently available
    if (!this.isActionAvailable(actionName, parameters)) {
      console.warn(`Action ${actionName} is not currently available or valid`);
      if (this.agent) {
        this.agent.recordFailedAction(actionName, "This action is not available in the current turn state");
        this.agent.addChatMessage(this.currentPlayer, `I tried to ${actionName}, but that action is not available right now.`);
      }
      return;
    }
    
    switch (actionName) {
      case 'upgradeCity':
        await this.aiUpgradeCity(parameters);
        break;
      case 'buyUnit':
        await this.aiBuyUnit(parameters);
        break;
      case 'moveUnit':
        await this.aiMoveUnit(parameters);
        break;
      case 'attackUnit':
        await this.aiAttackUnit(parameters);
        break;
      case 'foundCity':
        await this.aiFoundCity(parameters);
        break;
      case 'conquerCity':
        await this.aiConquerCity(parameters);
        break;
      case 'endTurn':
        // Just end the turn, nothing else needed
        break;
      default:
        console.warn(`Unknown AI action: ${actionName}`);
    }
  }

  // Helper to check if an action is actually available
  isActionAvailable(actionName, parameters) {
    // End turn is always available
    if (actionName === 'endTurn') {
      return true;
    }
    
    // Get the current available actions for this player
    const availableActions = this.agent ? 
      this.agent.evaluateAvailableActions(this.currentPlayer) : 
      {};
      
    // Check if the action type is in the available actions
    if (!availableActions[actionName] || !Array.isArray(availableActions[actionName]) || availableActions[actionName].length === 0) {
      console.warn(`Action type ${actionName} not available`);
      return false;
    }
    
    // For specific action types, validate parameters more carefully
    switch (actionName) {
      case 'foundCity':
        // Check if the specific unit can found a city
        const foundCityActions = availableActions.foundCity;
        return foundCityActions.some(action => action.unitId === parameters.unitId);
        
      case 'upgradeCity':
        // Check if the city can be upgraded
        return availableActions.upgradeCity.some(action => action.cityId === parameters.cityId);
        
      case 'buyUnit':
        // Check if can buy at this city
        return availableActions.buyUnit.some(action => action.cityId === parameters.cityId);
        
      case 'moveUnit':
        // Just check if unit can move (specific destination will be validated in move function)
        return availableActions.moveUnit.some(action => action.unitId === parameters.unitId);
        
      case 'attackUnit':
        // Check if unit can attack (specific target will be validated in attack function)
        return availableActions.attackUnit.some(action => action.unitId === parameters.unitId);
        
      case 'conquerCity':
        // Check if unit can conquer a city
        return availableActions.conquerCity.some(action => action.unitId === parameters.unitId);
        
      default:
        // Unknown action type
        return false;
    }
  }

  aiUpgradeCity(params) {
    const cityId = params.cityId;
    const city = this.currentPlayer.cities.find(c => c.id === cityId);
    
    if (!city) return;
    
    const upgradeCost = city.getUpgradeCost();
    
    if (this.currentPlayer.canAfford(upgradeCost)) {
      city.upgrade();
      this.ui.render();
    }
  }

  aiBuyUnit(params) {
    if (this.hasPurchasedUnitThisTurn) {
      console.log("Already purchased a unit this turn");
      return;
    }
    
    // Check if cityId exists or try to use a default city
    let cityId = params.cityId;
    let city;
    
    // If no cityId provided, try to get the first available city
    if (!cityId && this.currentPlayer.cities.length > 0) {
      city = this.currentPlayer.cities[0];
      console.log("No cityId provided, defaulting to first city:", city.id);
    } else {
      city = this.currentPlayer.cities.find(c => c.id === cityId);
    }
    
    if (!city) {
      console.log("City not found with ID:", cityId, "Available cities:", this.currentPlayer.cities.map(c => c.id));
      return;
    }
    
    const unitType = params.unitType || 'soldier';
    
    // Add hint about buying colonizers for expanding
    if (this.currentPlayer.cities.length < 3 && Math.random() > 0.7 && unitType !== 'colonizer') {
      console.log("Hint: Consider buying colonizers to expand your empire by creating new cities");
    }
    
    const cost = Unit.getCost(unitType);
    const existingUnit = this.getUnitAt(city.x, city.y);
    
    if (existingUnit) {
      console.log("There's already a unit at this city location");
      return;
    }
    
    if (this.currentPlayer.canAfford(cost)) {
      if (this.currentPlayer.spend(cost)) {
        const newUnit = new Unit(city.x, city.y, this.currentPlayer, unitType);
        this.currentPlayer.addUnit(newUnit);
        this.units.push(newUnit);
        this.hasPurchasedUnitThisTurn = true;
        
        console.log(`AI created a ${unitType} at (${city.x},${city.y})`);
        
        // Make sure we update the UI
        if (this.ui) {
          this.ui.render();
        }
      }
    } else {
      console.log(`Cannot afford ${unitType}. Cost: ${cost}, Available: ${this.currentPlayer.gold}`);
    }
  }

  aiMoveUnit(params) {
    // Get unitId from params, checking both unitId and id formats
    const unitId = params.unitId || params.id;
    const targetX = parseInt(params.x);
    const targetY = parseInt(params.y);
    
    if (isNaN(targetX) || isNaN(targetY)) {
      console.log("Invalid movement coordinates:", params.x, params.y);
      return;
    }
    
    if (!unitId) {
      console.log("No unitId provided in move parameters:", params);
      
      // Try to find any movable unit if none specified
      const availableUnits = this.currentPlayer.units.filter(u => !u.hasMoved);
      if (availableUnits.length > 0) {
        const unit = availableUnits[0];
        console.log("No unitId specified, defaulting to first available unit:", unit.id);
        
        this.handleUnitMovement(unit, targetX, targetY);
      } else {
        console.log("No available units to move");
      }
      return;
    }
    
    const unit = this.currentPlayer.units.find(u => u.id === unitId);
    if (!unit) {
      console.log("Unit not found with ID:", unitId, "Available units:", this.currentPlayer.units.map(u => u.id));
      return;
    }
    
    this.handleUnitMovement(unit, targetX, targetY);
  }
  
  // Helper method to handle unit movement logic
  handleUnitMovement(unit, targetX, targetY) {
    if (unit.hasMoved) {
      console.log("Unit has already moved this turn");
      return;
    }
    
    // Check if target position is already occupied
    const targetUnit = this.getUnitAt(targetX, targetY);
    if (targetUnit) {
      console.log("Target position is already occupied by another unit");
      return;
    }
    
    // Check if movement is valid (within range)
    if (unit.canMoveTo(targetX, targetY, this)) {
      console.log(`Moving unit from (${unit.x},${unit.y}) to (${targetX},${targetY})`);
      unit.move(targetX, targetY);
      
      // Make sure we update the UI
      if (this.ui) {
        this.ui.render();
      }
    } else {
      console.log(`Unit cannot move to (${targetX},${targetY}) from (${unit.x},${unit.y})`);
    }
  }

  aiAttackUnit(params) {
    const unitId = params.unitId || params.id;
    const targetX = params.x;
    const targetY = params.y;
    
    if (targetX === undefined || targetY === undefined) return;
    
    const unit = this.currentPlayer.units.find(u => u.id === unitId);
    if (!unit) return;
    
    const targetUnit = this.getUnitAt(targetX, targetY);
    
    if (targetUnit && targetUnit.player !== this.currentPlayer && !unit.hasAttacked) {
      // Calculate distance
      const dx = targetUnit.x - unit.x;
      const dy = targetUnit.y - unit.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if (distance <= 1.5) {
        const killed = unit.attack(targetUnit);
        if (killed) {
          targetUnit.player.removeUnit(targetUnit);
          this.removeUnit(targetUnit);
        }
        this.ui.render();
      }
    }
  }

  aiFoundCity(params) {
    const unitId = params.unitId;
    
    const unit = this.currentPlayer.units.find(u => u.id === unitId && u.type === 'colonizer');
    if (!unit) return;
    
    if (unit.canFoundCity()) {
      unit.foundCity(this);
      this.ui.render();
    } else {
      console.log("Couldn't found city. Remember that expanding your territory with multiple cities is a strong strategy!");
    }
  }

  aiConquerCity(params) {
    const unitId = params.unitId;
    
    const unit = this.currentPlayer.units.find(u => u.id === unitId);
    if (!unit) return;
    
    const city = this.getCityAt(unit.x, unit.y);
    
    if (city && city.player !== this.currentPlayer && unit.canConquerCity()) {
      unit.conquerCity(city, this);
      this.ui.render();
    }
  }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
});
