class Agent {
  constructor(game) {
    this.game = game;
    this.isThinking = false;
    this.chatHistory = [];
    this.pendingActions = []; // Queue to store pending actions
    this.currentGameState = null;
    this.currentPlayer = null;
    this.actionIntention = null;
    this.failedActions = []; // Track failed actions in the current turn
  }

  async getAction(player) {
    this.isThinking = true;
    
    try {
      // If we have pending actions, return the next one
      if (this.pendingActions.length > 0) {
        this.isThinking = false;
        return this.pendingActions.shift();
      }
      
      // Prepare game state information for the AI
      this.currentGameState = this.prepareGameState(player);
      this.currentPlayer = player;
      
      // Check if there are any actions available other than endTurn
      const availableActions = this.currentGameState.availableActions;
      console.log(availableActions);
      const hasActions = Object.entries(availableActions)
        .some(([action, value]) => {
          if (action === 'endTurn') return false;
          return Array.isArray(value) && value.length > 0;
        });
      
      // If no actions are available, end the turn automatically
      if (!hasActions) {
        console.log("No actions available for AI player, ending turn automatically");
        this.isThinking = false;
        this.addChatMessage(player, "Nothing else I can do this turn.");
        return { action: "endTurn", parameters: {} };
      }
      
      // Call Ollama API with the prompt
      const response = await this.callOllama(this.currentGameState);
      
      // Parse the AI's response
      const actionPlan = this.parseResponse(response);
      
      // Store the intention
      if (actionPlan.intention) {
        this.actionIntention = actionPlan.intention;
        // Add intention to chat history only once per turn
        this.addChatMessage(player, actionPlan.intention);
      }
      
      // If there are multiple actions, store all but the first for later
      if (actionPlan.actions && actionPlan.actions.length > 1) {
        this.pendingActions = actionPlan.actions.slice(1);
      }
      
      this.isThinking = false;
      
      // Return the first action
      return actionPlan.actions && actionPlan.actions.length > 0 ? 
             actionPlan.actions[0] : 
             { action: "endTurn", parameters: {} };
      
    } catch (error) {
      console.error("Error getting AI action:", error);
      this.isThinking = false;
      
      // Return a fallback action
      return {
        action: "endTurn",
        parameters: {}
      };
    }
  }

  // Add a new method to display chat messages
  addChatMessage(player, message) {
    const timestamp = new Date().toLocaleTimeString();
    this.chatHistory.push({
      player,
      message,
      timestamp
    });
    
    // Keep chat history limited to last 20 messages
    if (this.chatHistory.length > 20) {
      this.chatHistory.shift();
    }
    
    // Update the chat display
    this.updateChatDisplay();
  }
  
  // Method to update the chat UI
  updateChatDisplay() {
    const chatContainer = document.getElementById('agentChat');
    if (!chatContainer) return;
    
    // Clear and rebuild chat
    chatContainer.innerHTML = '';
    
    for (const entry of this.chatHistory) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'chat-message';
      
      const colorSpan = document.createElement('span');
      colorSpan.className = 'chat-color';
      colorSpan.style.backgroundColor = entry.player.color;
      
      const messageContent = document.createElement('div');
      messageContent.className = 'chat-content';
      
      const playerName = document.createElement('strong');
      playerName.textContent = entry.player.name;
      
      const messageText = document.createElement('span');
      messageText.textContent = entry.message;
      
      const timestamp = document.createElement('small');
      timestamp.className = 'chat-time';
      timestamp.textContent = entry.timestamp;
      
      messageContent.appendChild(playerName);
      messageContent.appendChild(document.createTextNode(': '));
      messageContent.appendChild(messageText);
      messageContent.appendChild(document.createElement('br'));
      messageContent.appendChild(timestamp);
      
      messageDiv.appendChild(colorSpan);
      messageDiv.appendChild(messageContent);
      
      chatContainer.appendChild(messageDiv);
    }
    
    // Auto-scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Method to evaluate all available actions for the current player
  evaluateAvailableActions(player) {
    const availableActions = {
      upgradeCity: [],
      buyUnit: [],
      moveUnit: [],
      attackUnit: [],
      foundCity: [],
      conquerCity: [],
      endTurn: true // Always available
    };

    // Check for cities that can be upgraded
    for (const city of player.cities) {
      const upgradeCost = city.getUpgradeCost();
      if (player.canAfford(upgradeCost)) {
        availableActions.upgradeCity.push({
          cityId: city.id,
          cost: upgradeCost
        });
      }
    }

    // Check for cities where units can be bought
    if (!this.game.hasPurchasedUnitThisTurn) {
      for (const city of player.cities) {
        // Check if city doesn't already have a unit on it
        const hasUnitAtCity = this.game.getUnitAt(city.x, city.y);
        if (!hasUnitAtCity) {
          // Check which unit types the player can afford
          const affordableUnits = [];
          ['soldier', 'knight', 'giant', 'dragon', 'colonizer'].forEach(type => {
            const cost = Unit.getCost(type);
            if (player.canAfford(cost)) {
              affordableUnits.push(type);
            }
          });

          if (affordableUnits.length > 0) {
            availableActions.buyUnit.push({
              cityId: city.id,
              affordableTypes: affordableUnits
            });
          }
        }
      }
    }

    // Check for units that can move
    for (const unit of player.units) {
      if (!unit.hasMoved) {
        availableActions.moveUnit.push({
          unitId: unit.id,
          type: unit.type,
          position: { x: unit.x, y: unit.y },
          movement: unit.movement
        });
      }
    }

    // Check for units that can attack
    for (const unit of player.units) {
      if (!unit.hasAttacked) {
        // Find nearby enemy units within attack range
        const potentialTargets = [];
        for (const otherPlayer of this.game.players) {
          if (otherPlayer.id === player.id) continue;
          
          for (const enemyUnit of otherPlayer.units) {
            const dx = enemyUnit.x - unit.x;
            const dy = enemyUnit.y - unit.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance <= 1.5) {  // Attack range is 1.5 units (allows diagonal)
              potentialTargets.push({
                unitId: enemyUnit.id,
                playerId: otherPlayer.id,
                position: { x: enemyUnit.x, y: enemyUnit.y },
                hp: enemyUnit.hp
              });
            }
          }
        }
        
        if (potentialTargets.length > 0) {
          availableActions.attackUnit.push({
            unitId: unit.id,
            type: unit.type,
            position: { x: unit.x, y: unit.y },
            potentialTargets
          });
        }
      }
    }

    // Check for colonizer units that can found cities
    for (const unit of player.units) {
      // More strict check for founding cities
      if (unit.type === 'colonizer' && unit.canFoundCity()) {
        // Double check there's no city at this location
        const existingCity = this.game.getCityAt(unit.x, unit.y);
        if (!existingCity) {
          availableActions.foundCity.push({
            unitId: unit.id,
            position: { x: unit.x, y: unit.y }
          });
        }
      }
    }

    // Check for units that can conquer cities
    for (const unit of player.units) {
      if (unit.canConquerCity()) {
        // Check if unit is on an enemy city
        const city = this.game.getCityAt(unit.x, unit.y);
        if (city && city.player.id !== player.id) {
          availableActions.conquerCity.push({
            unitId: unit.id,
            position: { x: unit.x, y: unit.y },
            cityId: city.id,
            cityOwner: city.player.id
          });
        }
      }
    }

    // Filter out keys with empty arrays or falsy values
    const nonEmptyActions = Object.fromEntries(
      Object.entries(availableActions).filter(([key, value]) => {
      return Array.isArray(value) ? value.length > 0 : value;
      })
    );

    return nonEmptyActions;
  }

  prepareGameState(player) {
    // Get all relevant game information
    const currentTurn = this.game.currentTurn;
    const ownCities = player.cities.map(city => ({
      id: city.id,
      x: city.x,
      y: city.y,
      level: city.level,
      territorySize: city.territorySize
    }));
    
    const ownUnits = player.units.map(unit => ({
      id: unit.id,
      type: unit.type,
      x: unit.x,
      y: unit.y,
      hp: unit.hp,
      maxHp: unit.maxHp,
      hasMoved: unit.hasMoved,
      hasAttacked: unit.hasAttacked,
      canFoundCity: unit.canFoundCity(),
      canConquerCity: unit.canConquerCity()
    }));
    
    // Get information about other players
    const otherPlayers = this.game.players
      .filter(p => p.id !== player.id)
      .map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        score: Utils.calculateScore(p),
        cities: p.cities.map(city => ({
          id: city.id,
          x: city.x,
          y: city.y,
          level: city.level
        })),
        units: p.units.map(unit => ({
          id: unit.id,
          type: unit.type,
          x: unit.x,
          y: unit.y,
          hp: unit.hp
        }))
      }));
    
    // Add diplomatic information
    const diplomacy = {
      favorMap: Array.from(player.diplomacy.favorMap).map(([playerId, favor]) => ({ 
        playerId, 
        favor 
      })),
      peaceTreaties: player.diplomacy.peaceTreaties,
      wars: player.diplomacy.wars,
      pendingTreaties: player.diplomacy.pendingTreaties.map(playerId => {
        const proposer = this.game.players.find(p => p.id === playerId);
        return {
          playerId,
          playerName: proposer ? proposer.name : "Unknown"
        };
      })
    };
    
    // Add available actions
    const availableActions = this.evaluateAvailableActions(player);
    
    // Create the prompt with game mechanics explanation and current state
    return {
      playerId: player.id,
      playerName: player.name,
      coins: player.coins,
      hasPurchasedUnitThisTurn: this.game.hasPurchasedUnitThisTurn,
      score: Utils.calculateScore(player),
      currentTurn,
      mapSize: this.game.mapSize,
      cities: ownCities,
      units: ownUnits,
      otherPlayers,
      diplomacy,
      availableActions, // Add available actions to the state
      gameMechanics: `
        Game Mechanics:
        - Players take turns to manage cities and units
        - Cities provide income (1 coin × level) each turn
        - Cities can be upgraded for level^2 coins
        - Cities claim territory around them based on their level
        - Only one unit can be purchased per turn
        - Units:
          * Soldier: Costs 3 coins, 5 HP, 2 ATK, moves 1 square
          * Knight: Costs 7 coins, 8 HP, 4 ATK, moves 2 squares
          * Giant: Costs 12 coins, 30 HP, 3 ATK, moves 1 square
          * Dragon: Costs 30 coins, 25 HP, 7 ATK, moves 3 squares
          * Colonizer: Costs 10 coins, 3 HP, 1 ATK, can found new cities
        - Units can move once and attack once per turn
        - Units attack adjacent enemies (including diagonally)
        - Colonizers can found new cities
        - Units can conquer enemy cities by moving onto them
        
        Also, here are some tips:
        - Building multiple cities with colonizers is often more effective than only upgrading a single city
        - Spread your cities to control more territory
        - City range only increases at levels 4, 7, and 10, so consider expanding horizontally with new cities
        - Having more cities means more income and production points
        
        Diplomacy Mechanics:
        - Players gain favor when others respect their territory and borders
        - Players lose favor when others enter their territory or approach borders
        - Peace treaties provide +2 coins per turn to both parties
        - Players in peace treaties cannot attack each other
        - Breaking a peace treaty loses all favor with that player and some with others
        - Players can declare war when favor is very low
        - Wars must last at least 10 turns before peace is possible
        - Players don't lose favor from military actions against declared enemies
        
        Diplomatic Tips:
        - Peace treaties increase your income and protect your borders
        - Consider accepting peace treaties with stronger neighbors
        - Breaking treaties damages your relations with everyone
        - Declare war when you have military advantage or need to eliminate a threat
        - Avoid violating territory of players you want to maintain relations with
      `
    };
  }

  async callOllama(gameState) {
    // Modify the prompt to include available actions
    const behavior = this.game.players.find(p => p.id === gameState.playerId).behavior;
    
    // Check if there are any actions available other than endTurn
    const hasActions = Object.entries(gameState.availableActions)
      .some(([action, value]) => {
        if (action === 'endTurn') return false;
        return Array.isArray(value) && value.length > 0;
      });
    
    // Generate a summary of available actions for the prompt
    const availableActionsSummary = Object.entries(gameState.availableActions)
      .map(([action, value]) => {
        if (action === 'endTurn') return null;
        if (Array.isArray(value) && value.length > 0) {
          if (action === 'upgradeCity') {
            return `- upgradeCity: ${value.length} cities can be upgraded. City IDs: [${value.map(c => c.cityId).join(', ')}]`;
          } else if (action === 'buyUnit') {
            return `- buyUnit: Can buy units at ${value.length} cities. City IDs: [${value.map(c => c.cityId).join(', ')}]`;
          } else if (action === 'moveUnit') {
            return `- moveUnit: ${value.length} units can move. Unit IDs: [${value.map(u => u.unitId).join(', ')}]`;
          } else if (action === 'attackUnit') {
            return `- attackUnit: ${value.length} units can attack enemy units. Unit IDs: [${value.map(u => u.unitId).join(', ')}]`;
          } else if (action === 'foundCity') {
            return `- foundCity: ${value.length} colonizers can found a new city. Unit IDs: [${value.map(u => u.unitId).join(', ')}]`;
          } else if (action === 'conquerCity') {
            return `- conquerCity: ${value.length} units can conquer enemy cities. Unit IDs: [${value.map(u => u.unitId).join(', ')}]`;
          }
          return `- ${action}: ${value.length} possible action(s)`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');
    
    // Add information about failed actions
    let failedActionsFeedback = '';
    if (this.failedActions.length > 0) {
      failedActionsFeedback = `
PREVIOUSLY FAILED ACTIONS THIS TURN:
${this.failedActions.map(fa => `- ${fa.action}: ${fa.reason}`).join('\n')}

Please avoid attempting these invalid actions again.
`;
    }
    
    const prompt = `
You are playing a turn-based strategy game. You control player "${gameState.playerName}" with ${gameState.coins} coins.
${gameState.gameMechanics}

YOUR NATION'S BEHAVIOR: ${behavior.type}
${behavior.description}

As a ${behavior.type} nation, you should prioritize certain actions over others, based on your national character.

CURRENT GAME STATE:
- Turn: ${gameState.currentTurn}
- Map size: ${gameState.mapSize}x${gameState.mapSize}
- Your cities: 
${gameState.cities.map(city => `  * City ID: ${city.id}, Position: (${city.x},${city.y}), Level: ${city.level}`).join('\n')}

- Your units: 
${gameState.units.map(unit => `  * Unit ID: ${unit.id}, Type: ${unit.type}, Position: (${unit.x},${unit.y}), HP: ${unit.hp}/${unit.maxHp}, Can move: ${!unit.hasMoved}, Can attack: ${!unit.hasAttacked}`).join('\n')}

- Other players: ${JSON.stringify(gameState.otherPlayers)}
- You ${gameState.hasPurchasedUnitThisTurn ? "have" : "have not"} purchased a unit this turn
${failedActionsFeedback}
AVAILABLE ACTIONS:
${hasActions ? availableActionsSummary : "No actions available except ending your turn."}

${hasActions ? "" : "Since no actions are available, you should end your turn."}

IMPORTANT RULES:
1. Always use correct city and unit IDs as shown above. Using incorrect IDs will result in actions being ignored.
2. ONLY colonizer units can found cities. The "foundCity" action can ONLY be used with a unit of type "colonizer".
3. Colonizers must not have moved in the current turn to found a city.
4. Double-check that a unit is a colonizer before attempting to found a city.
5. Colonizers can't colonize on an already existing city coordinate.
6. New cities MUST be at least 2 squares away from any existing city.
7. Only perform actions that are listed in the AVAILABLE ACTIONS section.
8. If no actions are available, end your turn.

Based on this information and your nation's behavior, decide what action to take next. 
Respond with a JSON object containing:
1. "intention": A brief explanation of your overall strategy and reasoning, reflecting your nation's behavior (only for your first action this turn)
2. "actions": An array containing just ONE action to take now, with the following structure:
   a. "action": The action to take (one of: "upgradeCity", "buyUnit", "moveUnit", "attackUnit", "foundCity", "conquerCity", "endTurn")
   b. "parameters": Required parameters for the action (e.g., cityId, unitId, coordinates, unit type, etc.)

After you perform this action, you'll be asked for your next action until you choose to end your turn.

Before you respond, be sure the action is valid and is part of the available actions.

Example responses:
1. Moving a unit:
{
  "intention": "I want to expand my territory and strengthen my position",
  "actions": [
    {
      "action": "moveUnit",
      "parameters": {
        "unitId": 2,
        "x": 5,
        "y": 7
      }
    }
  ]
}

2. Upgrading an EXISTING city (not creating a new one):
{
  "intention": "I want to strengthen my existing cities to expand my territory",
  "actions": [
    {
      "action": "upgradeCity",
      "parameters": {
        "cityId": 3  // Must be an existing city ID from the city list above
      }
    }
  ]
}

3. Buying a new colonizer unit:
{
  "intention": "I need colonizers to expand my empire with new cities",
  "actions": [
    {
      "action": "buyUnit",
      "parameters": {
        "cityId": 1,
        "unitType": "colonizer"  // This creates a colonizer that can later found cities
      }
    }
  ]
}

4. Founding a NEW city with a colonizer unit:
{
  "intention": "I want to expand my empire by establishing new colonies",
  "actions": [
    {
      "action": "foundCity",
      "parameters": {
        "unitId": 5  // This MUST be the ID of a colonizer unit, other unit types cannot found cities
      }
    }
  ]
}

5. Ending your turn when no more actions are possible:
{
  "intention": "I've completed all my strategic moves for this turn",
  "actions": [
    {
      "action": "endTurn",
      "parameters": {}
    }
  ]
}`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen2.5',
          prompt: prompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error("Error calling Ollama:", error);
      throw error;
    }
  }

  parseResponse(response) {
    try {
      // Extract JSON from the response (in case it's wrapped in markdown code blocks)
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                        response.match(/```\s*([\s\S]*?)\s*```/) || 
                        [null, response];
      
      const jsonStr = jsonMatch[1] || response;
      const cleanJsonStr = jsonStr.trim();
      
      // Parse the JSON response
      const parsedResponse = JSON.parse(cleanJsonStr);
      
      console.log("AI response:", parsedResponse);
      
      // Handle both new format (with actions array) and old format (single action)
      if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
        // New format with multiple actions
        if (!parsedResponse.intention || parsedResponse.actions.length === 0) {
          throw new Error("Invalid response format");
        }
        
        // Handle diplomacy actions in response
        if (parsedResponse.actions) {
          for (let i = 0; i < parsedResponse.actions.length; i++) {
            const action = parsedResponse.actions[i];
            
            if (action.action === 'acceptPeaceTreaty' && action.parameters && action.parameters.playerId !== undefined) {
              // Add handler for accepting peace treaties
              const fromPlayerId = action.parameters.playerId;
              const success = this.game.acceptPeaceTreaty(fromPlayerId, this.game.currentPlayer.id);
              if (success) {
                this.addChatMessage(this.game.currentPlayer, `I accept the peace treaty from ${this.game.players.find(p => p.id === fromPlayerId)?.name}. Let's prosper together!`);
              }
              // Remove this action from the array as it's handled separately
              parsedResponse.actions.splice(i, 1);
              i--;
            }
            else if (action.action === 'rejectPeaceTreaty' && action.parameters && action.parameters.playerId !== undefined) {
              // Add handler for rejecting peace treaties
              const fromPlayerId = action.parameters.playerId;
              const success = this.game.rejectPeaceTreaty(fromPlayerId, this.game.currentPlayer.id);
              if (success) {
                this.addChatMessage(this.game.currentPlayer, `I reject the peace treaty from ${this.game.players.find(p => p.id === fromPlayerId)?.name}. Now is not the time for peace.`);
              }
              // Remove this action from the array
              parsedResponse.actions.splice(i, 1);
              i--;
            }
          }
        }
        
        // Return the new format with intention and actions array
        return {
          intention: parsedResponse.intention,
          actions: parsedResponse.actions
        };
      } else {
        // Legacy format with single action - convert to new format
        if (!parsedResponse.action || !parsedResponse.intention) {
          throw new Error("Invalid action format");
        }
        
        return {
          intention: parsedResponse.intention,
          actions: [{
            action: parsedResponse.action,
            parameters: parsedResponse.parameters || {}
          }]
        };
      }
    } catch (error) {
      console.error("Error parsing AI response:", error, "Raw response:", response);
      // Return a fallback action
      return {
        intention: "Error parsing response, using fallback action",
        actions: [{
          action: "endTurn",
          parameters: {}
        }]
      };
    }
  }
  
  // New method to check if there are pending actions
  hasPendingActions() {
    return this.pendingActions.length > 0;
  }
  
  // Clear pending actions (e.g., at the end of a turn)
  clearPendingActions() {
    this.pendingActions = [];
    this.actionIntention = null;
    this.failedActions = []; // Clear failed actions at end of turn
  }

  aiFoundCity(params) {
    const unitId = params.unitId;
    
    // Find the unit without filtering by type first to provide better error messages
    const unit = this.currentPlayer.units.find(u => u.id === unitId);
    
    if (!unit) {
      console.error(`Cannot found city: No unit found with ID ${unitId}`);
      this.addChatMessage(this.currentPlayer, "Tried to found a city, but couldn't find the specified unit.");
      this.recordFailedAction("foundCity", `No unit found with ID ${unitId}`);
      return;
    }
    
    // Use our new validation helper
    const validation = Utils.validateFoundCityAction(unit, this.game);
    
    if (!validation.valid) {
      console.error(`Cannot found city: ${validation.reason}`);
      
      // Add a helpful message to the chat
      if (unit.type !== 'colonizer') {
        this.addChatMessage(this.currentPlayer, `I need a colonizer to found a city, but tried with a ${unit.type} instead.`);
        this.recordFailedAction("foundCity", `Unit is a ${unit.type}, not a colonizer`);
      } else {
        this.addChatMessage(this.currentPlayer, `Couldn't found city: ${validation.reason}`);
        this.recordFailedAction("foundCity", validation.reason);
      }
      return;
    }
    
    // If we're here, we have a valid colonizer that can found a city
    if (unit.foundCity(this.game)) {
      console.log("Successfully founded a new city! Expanding your empire is a great strategy.");
      this.ui.render();
    } else {
      console.log("Couldn't found city. Remember that expanding your territory with multiple cities is a strong strategy!");
      this.recordFailedAction("foundCity", "City founding failed for unknown reasons");
    }
  }

  // Add method to record failed actions
  recordFailedAction(action, reason) {
    console.log(`Recording failed action: ${action} - ${reason}`);
    this.failedActions.push({
      action,
      reason,
      timestamp: new Date().toISOString()
    });
  }
}
