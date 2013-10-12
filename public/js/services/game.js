angular.module('mean.system')
  .factory('game', ['socket', '$timeout', function (socket, $timeout) {

  var game = {
    id: null,
    players: [],
    playerIndex: 0,
    winningCard: -1,
    winningCardPlayer: -1,
    gameWinner: -1,
    table: [],
    czar: null,
    playerMinLimit: 3,
    playerMaxLimit: 6,
    pointLimit: null,
    state: null,
    round: 0,
    time: 0,
    curQuestion: null,
    notification: null,
    timeLimits: {}
  };

  var notificationQueue = [];
  var timeout = false;
  var self = this;

  var addToNotificationQueue = function(msg) {
    notificationQueue.push(msg);
    if (!timeout) { // Start a cycle if there isn't one
      setNotification();
    }
  };
  var setNotification = function() {
    if (notificationQueue.length === 0) { // If notificationQueue is empty, stop
      clearInterval(timeout);
      timeout = false;
      game.notification = '';
    } else {
      game.notification = notificationQueue.shift(); // Show a notification and check again in a bit
      timeout = $timeout(setNotification, 1300);
    }
  };

  var timeSetViaUpdate = false;
  var decrementTime = function() {
    console.log('decrementing time', game.time);
    if (game.time > 0 && !timeSetViaUpdate) {
      game.time--;
    } else {
      timeSetViaUpdate = false;
    }
    $timeout(decrementTime, 900);
  };

  socket.on('id', function(data) {
    game.id = data.id;
  });

  socket.on('prepareGame', function(data) {
    game.playerMinLimit = data.playerMinLimit;
    game.playerMaxLimit = data.playerMaxLimit;
    game.pointLimit = data.pointLimit;
    game.timeLimits = data.timeLimits;
  });

  socket.on('gameUpdate', function(data) {
    // console.log(data);

    var i;
    // Cache the index of the player in the players array
    for (i = 0; i < data.players.length; i++) {
      if (game.id === data.players[i].socketID) {
        game.playerIndex = i;
      }
    }

    var newState = (data.state !== game.state);

    //Handle updating game.time
    if (data.round !== game.round) {
      game.time = game.timeLimits.stateChoosing - 1;
      timeSetViaUpdate = true;
    } else if (newState && data.state === 'waiting for czar to decide') {
      game.time = game.timeLimits.stateJudging - 1;
      timeSetViaUpdate = true;
    } else if (newState && data.state === 'winner has been chosen') {
      game.time = game.timeLimits.stateResults - 1;
      timeSetViaUpdate = true;
    }

    // Set these properties on each update
    game.round = data.round;
    game.winningCard = data.winningCard;
    game.winningCardPlayer = data.winningCardPlayer;
    game.winnerAutopicked = data.winnerAutopicked;
    game.gameWinner = data.gameWinner;
    game.pointLimit = data.pointLimit;

    // Handle updating game.table
    if (data.table.length === 0) {
      game.table = [];
    } else {
      // All players represented in game.table
      var playersPicked = {};
      for (i = 0; i < game.table.length; i++) {
        playersPicked[game.table[i].player] = true;
      }
      // Only add new player's picks to game.table
      for (i = 0; i < data.table.length; i++) {
        if (!playersPicked[data.table[i].player]) {
          game.table.push(data.table[i]);
        }
      }
    }

    if (game.state !== 'waiting for players to pick') {
      game.players = data.players;
    }

    if (newState || game.curQuestion !== data.curQuestion) {
      game.state = data.state;
    }

    if (data.state === 'waiting for players to pick') {
      game.czar = data.czar;
      game.curQuestion = data.curQuestion;

      // Set notifications only when entering state
      if (newState) {
        if (game.czar === game.playerIndex) {
          addToNotificationQueue('You\'re the Card Czar! Players are choosing answers...');
        } else if (game.curQuestion.numAnswers === 1) {
          addToNotificationQueue('Select an answer!');
        } else {
          addToNotificationQueue('Select TWO answers!');
        }
      }

    } else if (data.state === 'winner has been chosen') {
      game.curQuestion = data.curQuestion;

    } else if (data.state === 'game dissolved' || data.state === 'game ended') {
      console.log('game dissolved or ended');
      game.players[game.playerIndex].hand = [];
    }
  });

  socket.on('notification', function(data) {
    addToNotificationQueue(data.notification);
  });

  game.joinGame = function(mode) {
    mode = mode || 'joinGame';
    var userID = !!window.user ? user._id : 'unauthenticated';
    socket.emit(mode,{userID: userID});
  };

  game.startGame = function() {
    socket.emit('startGame');
  };

  game.leaveGame = function() {
    socket.emit('leaveGame');
  };

  game.pickCards = function(cards) {
    socket.emit('pickCards',{cards: cards});
  };

  game.pickWinning = function(card) {
    socket.emit('pickWinning',{card: card.id});
  };

  decrementTime();

  return game;
}]);
