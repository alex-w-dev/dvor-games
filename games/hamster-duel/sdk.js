/**
 * Lightborn Platform SDK
 * Load from the platform origin, e.g. https://lightborn.ru/sdk.js
 *
 *   const sdk = await PlatformSDK.init();
 *   const player = await sdk.getPlayer();
 *   await sdk.player.setClientData({ mute: true });
 *   const server = await sdk.player.getServerData();
 *   const shared = await sdk.game.getData();
 */
(function (root) {
  "use strict";

  var CHANNEL = "lf-platform-sdk";
  var DEFAULT_TIMEOUT_MS = 15000;

  function makeRequestId() {
    return (
      "r_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function postToParent(payload) {
    if (!root.parent || root.parent === root) {
      return Promise.reject(new Error("PlatformSDK: game must run in platform iframe"));
    }
    root.parent.postMessage(payload, "*");
  }

  function waitForResponse(requestId, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        root.removeEventListener("message", onMessage);
        reject(new Error("PlatformSDK: host timeout"));
      }, timeoutMs || DEFAULT_TIMEOUT_MS);

      function onMessage(event) {
        var data = event.data;
        if (!data || data.channel !== CHANNEL || data.requestId !== requestId) {
          return;
        }
        clearTimeout(timer);
        root.removeEventListener("message", onMessage);
        if (data.type === "error") {
          reject(new Error(data.message || "PlatformSDK error"));
          return;
        }
        resolve(data);
      }

      root.addEventListener("message", onMessage);
    });
  }

  function request(type, extra, timeoutMs) {
    var requestId = makeRequestId();
    var payload = Object.assign({ channel: CHANNEL, type: type, requestId: requestId }, extra || {});
    var pending = waitForResponse(requestId, timeoutMs);
    try {
      postToParent(payload);
    } catch (err) {
      return Promise.reject(err);
    }
    return pending;
  }

  function createSdk(hello) {
    var phase = hello.phase || "idle";
    var phaseHandlers = [];
    var matchState = null;
    var matchStateHandlers = [];
    var matchMsgHandlers = [];
    var matchEndedHandlers = [];
    var matchSocket = null;

    function setPhase(next) {
      phase = next;
      for (var i = 0; i < phaseHandlers.length; i++) {
        try {
          phaseHandlers[i](phase);
        } catch (_) {}
      }
    }

    function ensureMatchSocket(url, ticket) {
      return new Promise(function (resolve, reject) {
        if (typeof root.WebSocket === "undefined") {
          reject(new Error("WebSocket unavailable"));
          return;
        }
        var base = String(url || "").replace(/\/$/, "");
        if (base.indexOf("https://") === 0) {
          base = "wss://" + base.slice("https://".length);
        } else if (base.indexOf("http://") === 0) {
          base = "ws://" + base.slice("http://".length);
        }
        var wsUrl = base + "/match?ticket=" + encodeURIComponent(ticket);
        var ws = new root.WebSocket(wsUrl);
        matchSocket = ws;
        ws.onopen = function () {
          resolve(ws);
        };
        ws.onerror = function () {
          reject(new Error("PlatformSDK: match socket error"));
        };
        ws.onmessage = function (ev) {
          var msg;
          try {
            msg = JSON.parse(ev.data);
          } catch (_) {
            return;
          }
          if (msg.type === "state") {
            matchState = msg.state;
            for (var i = 0; i < matchStateHandlers.length; i++) {
              try {
                matchStateHandlers[i](matchState);
              } catch (_) {}
            }
          } else if (msg.type === "phase") {
            setPhase(msg.phase);
          } else if (msg.type === "message") {
            for (var j = 0; j < matchMsgHandlers.length; j++) {
              try {
                matchMsgHandlers[j](msg.name, msg.payload);
              } catch (_) {}
            }
          } else if (msg.type === "ended") {
            setPhase("lobby");
            if (matchState && typeof matchState === "object") {
              matchState = Object.assign({}, matchState, {
                phase: "ended",
                reason: msg.reason || matchState.reason || "ended",
              });
              for (var k = 0; k < matchStateHandlers.length; k++) {
                try {
                  matchStateHandlers[k](matchState);
                } catch (_) {}
              }
            }
            for (var e = 0; e < matchEndedHandlers.length; e++) {
              try {
                matchEndedHandlers[e](msg.reason || "ended");
              } catch (_) {}
            }
          }
        };
        ws.onclose = function () {
          if (matchSocket === ws) matchSocket = null;
        };
      });
    }

    return {
      gameId: hello.gameId,
      slug: hello.slug || null,
      getPlayer: function (opts) {
        var signed = !!(opts && opts.signed);
        return request("player", { signed: signed }).then(function (res) {
          return res.player;
        });
      },
      login: function () {
        return request("login", null, 300000).then(function (res) {
          if (res.type === "login-cancel") {
            throw new Error("PlatformSDK: login cancelled");
          }
          return undefined;
        });
      },
      player: {
        getClientData: function () {
          return request("player-get-client-data").then(function (res) {
            return res.data || {};
          });
        },
        setClientData: function (data) {
          return request("player-set-client-data", { data: data || {} }).then(
            function () {
              return undefined;
            },
          );
        },
        getServerData: function () {
          return request("player-get-server-data").then(function (res) {
            return res.data || {};
          });
        },
        /** @deprecated alias → getClientData */
        getData: function () {
          return request("player-get-client-data").then(function (res) {
            return res.data || {};
          });
        },
        /** @deprecated alias → setClientData */
        setData: function (data) {
          return request("player-set-client-data", { data: data || {} }).then(
            function () {
              return undefined;
            },
          );
        },
      },
      game: {
        getData: function () {
          return request("game-get-shared").then(function (res) {
            return res.data || {};
          });
        },
      },
      getPhase: function () {
        return phase;
      },
      onPhase: function (handler) {
        phaseHandlers.push(handler);
        return function () {
          phaseHandlers = phaseHandlers.filter(function (h) {
            return h !== handler;
          });
        };
      },
      lobby: {
        join: function () {
          return request("lobby-join").then(function (res) {
            setPhase("lobby");
            return res.lobby;
          });
        },
        leave: function () {
          return request("lobby-leave").then(function () {
            setPhase("idle");
          });
        },
        getPlayers: function () {
          return request("lobby-players").then(function (res) {
            return res.players || [];
          });
        },
        queue: function (mode) {
          return request("lobby-queue", { mode: mode || null }).then(function () {
            setPhase("queue");
          });
        },
        cancelQueue: function () {
          return request("lobby-cancel-queue").then(function () {
            setPhase("lobby");
          });
        },
      },
      match: {
        join: function (ticket) {
          return request("match-join", { ticket: ticket || null }).then(function (res) {
            setPhase("match");
            return ensureMatchSocket(res.matchRuntimeUrl, res.ticket).then(function () {
              return {
                roomId: res.roomId || "",
                players: res.players || [],
                state: matchState,
              };
            });
          });
        },
        leave: function () {
          if (matchSocket) {
            try {
              matchSocket.close();
            } catch (_) {}
            matchSocket = null;
          }
          return request("match-leave").then(function () {
            setPhase("lobby");
          });
        },
        send: function (type, payload) {
          if (!matchSocket || matchSocket.readyState !== 1) return;
          matchSocket.send(
            JSON.stringify({ type: "message", name: type, payload: payload }),
          );
        },
        onState: function (handler) {
          matchStateHandlers.push(handler);
          return function () {
            matchStateHandlers = matchStateHandlers.filter(function (h) {
              return h !== handler;
            });
          };
        },
        onMessage: function (handler) {
          matchMsgHandlers.push(handler);
          return function () {
            matchMsgHandlers = matchMsgHandlers.filter(function (h) {
              return h !== handler;
            });
          };
        },
        onEnded: function (handler) {
          matchEndedHandlers.push(handler);
          return function () {
            matchEndedHandlers = matchEndedHandlers.filter(function (h) {
              return h !== handler;
            });
          };
        },
        getState: function () {
          return matchState;
        },
      },
      payments: {
        getLeavesBalance: function () {
          return request("payments-leaves").then(function (res) {
            return res.leavesBalance || 0;
          });
        },
        listProducts: function () {
          return request("payments-products").then(function (res) {
            return res.products || [];
          });
        },
        purchase: function (productId) {
          return request("payments-purchase", { productId: productId }).then(
            function (res) {
              return { ok: true, productId: res.productId || productId };
            },
          );
        },
      },
    };
  }

  var PlatformSDK = {
    init: function () {
      return request("hello").then(function (res) {
        if (res.type !== "hello-ok") {
          throw new Error("PlatformSDK: unexpected hello response");
        }
        return createSdk(res);
      });
    },
  };

  root.PlatformSDK = PlatformSDK;
})(typeof window !== "undefined" ? window : this);
