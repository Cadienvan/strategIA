class UI {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('gameBoard');
    this.ctx = this.canvas.getContext('2d');
    
    // Dynamically adjust cell size based on map dimensions
    this.adjustCellSize();
    
    this.selectedEntity = null;
    this.actionPanel = document.getElementById('actionPanel');
    this.actionButtons = document.getElementById('actionButtons');
    this.actionTitle = document.getElementById('actionTitle');
    
    // Add logging for initialization
    console.log('UI initialized, game:', this.game);
    this.setupEventListeners();
    this.resize();
  }

  adjustCellSize() {
    // Get available space (with some margins)
    const maxWidth = Math.min(window.innerWidth * 0.7, 900);
    const maxHeight = Math.min(window.innerHeight * 0.7, 700);
    
    // Calculate cell size to fit the map within available space
    const horizontalCells = this.game.mapSize;
    const verticalCells = this.game.mapSize;
    
    const cellByWidth = maxWidth / horizontalCells;
    const cellByHeight = maxHeight / verticalCells;
    
    // Use the smaller value to ensure the entire map fits
    this.cellSize = Math.floor(Math.min(cellByWidth, cellByHeight));
    
    // Set minimum cell size to ensure visibility
    this.cellSize = Math.max(this.cellSize, 5);
    
    console.log(`Adjusted cell size to ${this.cellSize}px for ${this.game.mapSize}x${this.game.mapSize} map`);
  }
  
  resize() {
    // Set canvas dimensions based on game size and adjusted cell size
    this.canvas.width = this.cellSize * this.game.mapSize;
    this.canvas.height = this.cellSize * this.game.mapSize;
    
    // Ensure CSS size matches the canvas size to prevent scaling issues
    this.canvas.style.width = this.canvas.width + 'px';
    this.canvas.style.height = this.canvas.height + 'px';
    
    console.log(`Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
  }

  setupEventListeners() {
    console.log('Setting up event listeners');
    this.canvas.addEventListener('click', (e) => {
      // Get the accurate position considering any CSS transformations
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      
      // Calculate the actual position in canvas coordinates
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      
      // Convert to grid coordinates
      const x = Math.floor(canvasX / this.cellSize);
      const y = Math.floor(canvasY / this.cellSize);
      
      console.log(`Raw click at (${e.clientX - rect.left}, ${e.clientY - rect.top})`);
      console.log(`Canvas size: ${this.canvas.width}x${this.canvas.height}, Rect: ${rect.width}x${rect.height}`);
      console.log(`Calculated grid coordinates: (${x}, ${y})`);
      
      if (x >= 0 && x < this.game.mapSize && y >= 0 && y < this.game.mapSize) {
        this.handleClick(x, y);
      } else {
        console.log('Click outside game board');
      }
    });
  }

  handleClick(x, y) {
    // Don't allow interaction when AI is processing a turn
    if (this.game.isProcessingAITurn) {
      return;
    }
    
    console.log(`Handling click at (${x}, ${y})`);
    console.log(`Current selected entity:`, this.selectedEntity);
    
    // Check what exists at the clicked location
    const clickedUnit = this.game.getUnitAt(x, y);
    const clickedCity = this.game.getCityAt(x, y);
    
    console.log('Clicked on unit:', clickedUnit);
    console.log('Clicked on city:', clickedCity);
    
    // Handle unit movement if a unit is already selected
    if (this.selectedEntity && this.selectedEntity instanceof Unit) {
      console.log('Have selected unit, checking for movement or attack');
      
      // Check for movement to empty cell
      if (!clickedUnit && !clickedCity) {
        console.log('Attempting to move to empty cell');
        if (this.selectedEntity.player === this.game.currentPlayer && 
            this.selectedEntity.canMoveTo(x, y, this.game)) {
          console.log('Moving unit');
          this.selectedEntity.move(x, y);
          this.selectedEntity = null;
          this.hideActionPanel();
          this.render();
          return;
        } else {
          console.log('Cannot move to this location');
          if (this.selectedEntity.player !== this.game.currentPlayer) {
            console.log('Not current player\'s unit');
          }
          if (!this.selectedEntity.canMoveTo(x, y, this.game)) {
            console.log('Movement not allowed by unit rules');
          }
        }
      }
      
      // Check for attack on enemy unit
      if (clickedUnit && clickedUnit.player !== this.game.currentPlayer) {
        console.log('Attempting to attack enemy unit');
        
        // Calculate Euclidean distance for attack (same as movement)
        const dx = clickedUnit.x - this.selectedEntity.x;
        const dy = clickedUnit.y - this.selectedEntity.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        // Allow attack if units are adjacent (distance close to 1)
        if (!this.selectedEntity.hasAttacked && distance <= 1.5) {
          console.log('Attacking unit');
          const killed = this.selectedEntity.attack(clickedUnit);
          if (killed) {
            clickedUnit.player.removeUnit(clickedUnit);
            this.game.removeUnit(clickedUnit);
            console.log('Enemy unit killed');
          }
          this.selectedEntity = null;
          this.hideActionPanel();
          this.render();
          return;
        } else {
          console.log('Cannot attack: hasAttacked =', this.selectedEntity.hasAttacked, 'distance =', distance);
        }
      }

      // NEW SECTION: Handle movement onto an enemy city
      if (clickedCity && clickedCity.player !== this.game.currentPlayer) {
        console.log('Attempting to move onto enemy city');
        
        if (this.selectedEntity.player === this.game.currentPlayer && 
            this.selectedEntity.canMoveTo(x, y, this.game)) {
          console.log('Moving unit onto enemy city');
          this.selectedEntity.move(x, y);
          this.showUnitActions(this.selectedEntity, clickedCity);
          this.render();
          return;
        }
      }

      // Check if unit is on an enemy city that can be conquered
      if (clickedCity && clickedCity.player !== this.game.currentPlayer &&
          this.selectedEntity.x === clickedCity.x && this.selectedEntity.y === clickedCity.y) {
        if (this.selectedEntity.canConquerCity()) {
          this.showUnitActions(this.selectedEntity, clickedCity);
          return;
        }
      }
    }

    // Handle new selections
    if (clickedUnit) {
      console.log('Selecting unit:', clickedUnit);
      this.selectedEntity = clickedUnit;
      if (clickedUnit.player === this.game.currentPlayer) {
        this.showUnitActions(clickedUnit);
      } else {
        this.showEnemyUnitInfo(clickedUnit);
      }
      this.render();
      return;
    } 
    
    if (clickedCity) {
      console.log('Selecting city:', clickedCity);
      this.selectedEntity = clickedCity;
      if (clickedCity.player === this.game.currentPlayer) {
        this.showCityActions(clickedCity);
      } else {
        this.showEnemyCityInfo(clickedCity);
      }
      this.render();
      return;
    }
    
    // If we reached here, we clicked on empty space with no valid action
    console.log('Deselecting, no action taken');
    this.selectedEntity = null;
    this.hideActionPanel();
    this.render();
  }

  showCityActions(city) {
    this.actionTitle.textContent = `City (Level ${city.level})`;
    this.actionButtons.innerHTML = '';
    
    const upgradeCost = city.getUpgradeCost();
    const upgradeBtn = document.createElement('button');
    upgradeBtn.textContent = `Upgrade (${upgradeCost} coins)`;
    upgradeBtn.disabled = !city.player.canAfford(upgradeCost);
    upgradeBtn.addEventListener('click', () => {
      if (city.upgrade()) {
        this.hideActionPanel();
        this.render();
        this.game.updateRankings();
      }
    });
    this.actionButtons.appendChild(upgradeBtn);

    const unitTypes = ['soldier', 'knight', 'colonizer', 'giant', 'dragon'];
    for (const type of unitTypes) {
      const cost = Unit.getCost(type);
      const canAfford = city.player.canAfford(cost);
      const unitExists = this.game.getUnitAt(city.x, city.y);
      
      const btn = document.createElement('button');
      btn.textContent = `Buy ${type.charAt(0).toUpperCase() + type.slice(1)} (${cost} coins)`;
      btn.disabled = !canAfford || unitExists || this.game.hasPurchasedUnitThisTurn;
      
      btn.addEventListener('click', () => {
        if (city.player.spend(cost)) {
          const newUnit = new Unit(city.x, city.y, city.player, type);
          city.player.addUnit(newUnit);
          this.game.units.push(newUnit);
          this.game.hasPurchasedUnitThisTurn = true;
          this.hideActionPanel();
          this.render();
          this.game.updateRankings();
        }
      });
      
      this.actionButtons.appendChild(btn);
    }
    
    this.actionPanel.style.display = 'block';
  }

  showUnitActions(unit, enemyCity = null) {
    this.actionTitle.textContent = `${unit.type.charAt(0).toUpperCase() + unit.type.slice(1)} Actions`;
    this.actionButtons.innerHTML = '';
    
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `HP: ${unit.hp}/${unit.maxHp} | ATK: ${unit.atk} | Movement: ${unit.movement}`;
    if (unit.hasMoved) infoDiv.innerHTML += ' (Moved)';
    if (unit.hasAttacked) infoDiv.innerHTML += ' (Attacked)';
    this.actionButtons.appendChild(infoDiv);
    
    // Add "Found City" button for colonizers
    if (unit.canFoundCity()) {
      const foundCityBtn = document.createElement('button');
      foundCityBtn.textContent = 'Found New City';
      foundCityBtn.addEventListener('click', () => {
        if (unit.foundCity(this.game)) {
          this.selectedEntity = null;
          this.hideActionPanel();
          this.render();
          this.game.updateRankings();
        }
      });
      this.actionButtons.appendChild(foundCityBtn);
    }
    
    // Add "Colonize" button when unit is standing on an enemy city
    if (enemyCity && unit.canConquerCity()) {
      const conquerBtn = document.createElement('button');
      conquerBtn.textContent = `Conquer City (${enemyCity.player.name})`;
      conquerBtn.addEventListener('click', () => {
        if (unit.conquerCity(enemyCity, this.game)) {
          this.selectedEntity = null;
          this.hideActionPanel();
          this.render();
          this.game.updateRankings();
        }
      });
      this.actionButtons.appendChild(conquerBtn);
    }
    
    this.actionPanel.style.display = 'block';
  }

  showEnemyCityInfo(city) {
    this.actionTitle.textContent = `Enemy City`;
    this.actionButtons.innerHTML = '';
    
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `Level: ${city.level} | Owner: ${city.player.name}`;
    this.actionButtons.appendChild(infoDiv);
    
    this.actionPanel.style.display = 'block';
  }

  showEnemyUnitInfo(unit) {
    this.actionTitle.textContent = `Enemy ${unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}`;
    this.actionButtons.innerHTML = '';
    
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `HP: ${unit.hp}/${unit.maxHp} | ATK: ${unit.atk} | Owner: ${unit.player.name}`;
    this.actionButtons.appendChild(infoDiv);
    
    this.actionPanel.style.display = 'block';
  }

  hideActionPanel() {
    this.actionPanel.style.display = 'none';
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderGrid();
    this.renderTerritory();
    this.renderCities();
    this.renderUnits();
    this.renderSelection();
    this.updateGameInfo();
  }

  renderGrid() {
    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 1;
    
    for (let x = 0; x <= this.game.mapSize; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.cellSize, 0);
      this.ctx.lineTo(x * this.cellSize, this.canvas.height);
      this.ctx.stroke();
    }
    
    for (let y = 0; y <= this.game.mapSize; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.cellSize);
      this.ctx.lineTo(this.canvas.width, y * this.cellSize);
      this.ctx.stroke();
    }
  }

  renderTerritory() {
    // Create a territory map
    const territoryMap = Array(this.game.mapSize).fill().map(() => Array(this.game.mapSize).fill(null));
    
    for (const player of this.game.players) {
      for (const city of player.cities) {
        // The city cell itself is fully claimed
        territoryMap[city.y][city.x] = { player, level: Number.MAX_SAFE_INTEGER };
        
        // Add territory influence
        for (const tile of city.territory) {
          const { x, y, level } = tile;
          
          if (x >= 0 && x < this.game.mapSize && y >= 0 && y < this.game.mapSize) {
            // If no one has claimed this cell or our city level is higher
            if (!territoryMap[y][x] || territoryMap[y][x].level < level) {
              territoryMap[y][x] = { player, level };
            }
          }
        }
      }
    }
    
    // Render territory
    for (let y = 0; y < this.game.mapSize; y++) {
      for (let x = 0; x < this.game.mapSize; x++) {
        const territory = territoryMap[y][x];
        if (territory) {
          // Check if this is current player's territory
          if (territory.player === this.game.currentPlayer) {
            this.ctx.fillStyle = '#E0E0E0'; // Light gray for current player's territory
          } else {
            // Use the pre-defined lighter territory color
            this.ctx.fillStyle = territory.player.territoryColor;
          }
          this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
  }

  renderCities() {
    for (const player of this.game.players) {
      for (const city of player.cities) {
        // Draw city square
        if (player === this.game.currentPlayer) {
          this.ctx.fillStyle = '#FFFFFF'; // White for current player's cities
        } else {
          this.ctx.fillStyle = player.color;
        }
        
        this.ctx.fillRect(
          city.x * this.cellSize + 2, 
          city.y * this.cellSize + 2, 
          this.cellSize - 4, 
          this.cellSize - 4
        );
        
        // Draw city level - black text for current player (on white background)
        if (player === this.game.currentPlayer) {
          this.ctx.fillStyle = '#000000';
        } else {
          this.ctx.fillStyle = '#fff';
        }
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
          city.level.toString(), 
          city.x * this.cellSize + this.cellSize / 2, 
          city.y * this.cellSize + this.cellSize / 2
        );
      }
    }
  }

  renderUnits() {
    for (const unit of this.game.units) {
      // Draw unit circle
      if (unit.player === this.game.currentPlayer) {
        this.ctx.fillStyle = '#FFFFFF'; // White for current player's units
      } else {
        this.ctx.fillStyle = unit.player.color;
      }
      
      this.ctx.beginPath();
      this.ctx.arc(
        unit.x * this.cellSize + this.cellSize / 2,
        unit.y * this.cellSize + this.cellSize / 2,
        this.cellSize / 2 - 4,
        0, 2 * Math.PI
      );
      this.ctx.fill();
      
      // Draw unit symbol - black for current player (on white background)
      if (unit.player === this.game.currentPlayer) {
        this.ctx.fillStyle = '#000000';
      } else {
        this.ctx.fillStyle = '#fff';
      }
      this.ctx.font = 'bold 14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        unit.symbol,
        unit.x * this.cellSize + this.cellSize / 2,
        unit.y * this.cellSize + this.cellSize / 2
      );
      
      // Draw HP bar
      const hpPercentage = unit.hp / unit.maxHp;
      const barWidth = this.cellSize - 10;
      
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(
        unit.x * this.cellSize + 5,
        unit.y * this.cellSize + this.cellSize - 8,
        barWidth,
        4
      );
      
      this.ctx.fillStyle = hpPercentage > 0.6 ? '#0f0' : hpPercentage > 0.3 ? '#ff0' : '#f00';
      this.ctx.fillRect(
        unit.x * this.cellSize + 5,
        unit.y * this.cellSize + this.cellSize - 8,
        barWidth * hpPercentage,
        4
      );
    }
  }

  renderSelection() {
    if (!this.selectedEntity) return;
    
    // Highlight the selected entity
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.rect(
      this.selectedEntity.x * this.cellSize + 1,
      this.selectedEntity.y * this.cellSize + 1,
      this.cellSize - 2,
      this.cellSize - 2
    );
    this.ctx.stroke();
    
    // If it's a unit and belongs to current player, show valid movement range
    if (this.selectedEntity instanceof Unit && 
        this.selectedEntity.player === this.game.currentPlayer &&
        !this.selectedEntity.hasMoved) {
      
      // Use a more translucent green for movement area
      this.ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
      
      // Check all possible moves within unit's movement range
      const maxRange = Math.ceil(this.selectedEntity.movement);
      
      for (let dx = -maxRange; dx <= maxRange; dx++) {
        for (let dy = -maxRange; dy <= maxRange; dy++) {
          // Use Chebyshev distance for ALL units (allowing diagonal movement)
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          
          if (distance <= this.selectedEntity.movement) {
            const nx = this.selectedEntity.x + dx;
            const ny = this.selectedEntity.y + dy;
            
            // Only highlight valid move locations
            if (nx >= 0 && nx < this.game.mapSize && 
                ny >= 0 && ny < this.game.mapSize &&
                !this.game.getUnitAt(nx, ny) && 
                !this.game.getCityAt(nx, ny)) {
              
              // Fill only the valid moves with the green color
              this.ctx.fillRect(
                nx * this.cellSize,
                ny * this.cellSize,
                this.cellSize,
                this.cellSize
              );
            }
          }
        }
      }
    }
  }

  updateGameInfo() {
    const currentPlayer = this.game.currentPlayer;
    const playerInfo = document.getElementById('currentPlayerInfo');
    
    let infoHtml = `<span style="color:${currentPlayer.color}">● </span>
                     ${currentPlayer.name} | Coins: ${currentPlayer.coins} | 
                     Turn: ${this.game.currentTurn}`;
    
    // Add thinking indicator if AI is processing a turn
    if (this.game.agentMode && this.game.agent && this.game.agent.isThinking) {
      infoHtml += ` <span class="thinking">AI thinking...</span>`;
    }
    
    playerInfo.innerHTML = infoHtml;
    
    this.updateRankings();
    this.updateDiplomaticRelations(); // Add new method call to update diplomatic info
  }
  
  // Add new method to handle displaying diplomatic relations
  updateDiplomaticRelations() {
    const gameInfo = document.getElementById('gameInfo');
    const currentPlayer = this.game.currentPlayer;
    
    if (!gameInfo || !currentPlayer.diplomacy) return;
    
    let infoHTML = '<h4>Diplomatic Relations</h4>';
    
    // Display peace treaties
    if (currentPlayer.diplomacy.peaceTreaties.length > 0) {
      infoHTML += '<div class="diplomatic-group"><strong>Peace Treaties:</strong><ul>';
      for (const treaty of currentPlayer.diplomacy.peaceTreaties) {
        const ally = this.game.players.find(p => p.id === treaty.playerId);
        if (ally) {
          infoHTML += `<li>
            <span class="player-color" style="background-color:${ally.color}"></span>
            ${ally.name} (${treaty.turnsActive} turns) +${treaty.bonusCoins} coins/turn
          </li>`;
        }
      }
      infoHTML += '</ul></div>';
    }
    
    // Display wars
    if (currentPlayer.diplomacy.wars.length > 0) {
      infoHTML += '<div class="diplomatic-group"><strong>At War With:</strong><ul>';
      for (const war of currentPlayer.diplomacy.wars) {
        const enemy = this.game.players.find(p => p.id === war.playerId);
        if (enemy) {
          infoHTML += `<li>
            <span class="player-color" style="background-color:${enemy.color}"></span>
            ${enemy.name} (${war.turnsRemaining} turns until peace possible)
          </li>`;
        }
      }
      infoHTML += '</ul></div>';
    }
    
    // Display favor levels with other players
    infoHTML += '<div class="diplomatic-group"><strong>Relations:</strong><ul>';
    for (const player of this.game.players) {
      if (player.id === currentPlayer.id) continue;
      
      const favor = currentPlayer.diplomacy.getFavor(player.id);
      let relationStatus = 'Neutral';
      let relationColor = '#888';
      
      if (favor > 50) {
        relationStatus = 'Friendly';
        relationColor = '#4CAF50';
      } else if (favor < -50) {
        relationStatus = 'Hostile';
        relationColor = '#FF4136';
      }
      
      infoHTML += `<li>
        <span class="player-color" style="background-color:${player.color}"></span>
        ${player.name}: <span style="color:${relationColor}">${relationStatus}</span> (${favor})
      </li>`;
    }
    infoHTML += '</ul></div>';
    
    // Add diplomatic actions if it's human player's turn and not in AI mode
    if (!this.game.agentMode) {
      infoHTML += '<div class="diplomatic-actions">';
      infoHTML += '<strong>Diplomatic Actions:</strong><div class="action-buttons">';
      
      // Loop through other players to create action buttons
      for (const player of this.game.players) {
        if (player.id === currentPlayer.id) continue;
        
        // Check if there's an existing peace treaty
        const hasTreaty = currentPlayer.diplomacy.hasPeaceTreaty(player.id);
        // Check if there's an existing war
        const atWar = currentPlayer.diplomacy.isAtWar(player.id);
        // Get favor level
        const favor = currentPlayer.diplomacy.getFavor(player.id);
        
        if (hasTreaty) {
          const breakBtn = document.createElement('button');
          breakBtn.className = 'diplomatic-button break-treaty';
          breakBtn.textContent = `Break treaty with ${player.name}`;
          breakBtn.addEventListener('click', () => {
            this.game.breakPeaceTreaty(currentPlayer.id, player.id);
            this.updateDiplomaticRelations();
          });
          infoHTML += breakBtn.outerHTML;
        } else if (atWar) {
          // War status info only, peace button appears after 10 turns
          const warInfo = currentPlayer.diplomacy.getWarWith(player.id);
          if (warInfo && warInfo.turnsRemaining <= 0) {
            const peaceBtn = document.createElement('button');
            peaceBtn.className = 'diplomatic-button propose-peace';
            peaceBtn.textContent = `Propose peace to ${player.name}`;
            peaceBtn.addEventListener('click', () => {
              this.game.proposePeace(currentPlayer.id, player.id);
              this.updateDiplomaticRelations();
            });
            infoHTML += peaceBtn.outerHTML;
          }
        } else if (favor >= 0) {
          // Only show treaty option when favor is neutral or positive
          const treatyBtn = document.createElement('button');
          treatyBtn.className = 'diplomatic-button propose-treaty';
          treatyBtn.textContent = `Propose treaty to ${player.name}`;
          treatyBtn.addEventListener('click', () => {
            this.game.proposePeaceTreaty(currentPlayer.id, player.id);
            this.updateDiplomaticRelations();
          });
          infoHTML += treatyBtn.outerHTML;
        } else if (favor < -50) {
          // Only show war declaration when favor is very negative
          const warBtn = document.createElement('button');
          warBtn.className = 'diplomatic-button declare-war';
          warBtn.textContent = `Declare war on ${player.name}`;
          warBtn.addEventListener('click', () => {
            this.game.declareWar(currentPlayer.id, player.id);
            this.updateDiplomaticRelations();
          });
          infoHTML += warBtn.outerHTML;
        }
      }
      
      infoHTML += '</div></div>';
    }
    
    gameInfo.innerHTML = infoHTML;
  }

  updateThinkingState(isThinking) {
    if (this.game.agent) {
      this.game.agent.isThinking = isThinking;
    }
    this.updateGameInfo();
  }

  updateRankings() {
    const rankingsList = document.getElementById('playerRankings');
    rankingsList.innerHTML = '';
    
    // Sort players by score
    const sortedPlayers = [...this.game.players].sort((a, b) => 
      Utils.calculateScore(b) - Utils.calculateScore(a)
    );
    
    for (const player of sortedPlayers) {
      const score = Utils.calculateScore(player);
      const li = document.createElement('li');
      li.innerHTML = `<span class="player-color" style="background-color:${player.color}"></span>
                     ${player.name}: ${score} points`;
      rankingsList.appendChild(li);
    }
  }
}
