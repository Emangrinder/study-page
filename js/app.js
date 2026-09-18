(function () {
  "use strict";

  var app = document.getElementById("app");
  var topicsCache = null;
  var deckDataCache = {}; // dataFile -> cards array

  // ---------------- Router ----------------

  function parseHash() {
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/").filter(Boolean).map(decodeURIComponent);
    return parts; // e.g. [], ["topic", id], ["deck", topicId, deckId], ["study", topicId, deckId]
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", route);

  function navigate(path) {
    location.hash = path;
  }

  function route() {
    var parts = parseHash();
    loadTopics().then(function (topics) {
      if (parts.length === 0) {
        renderHome(topics);
      } else if (parts[0] === "topic" && parts[1]) {
        renderTopic(topics, parts[1]);
      } else if (parts[0] === "deck" && parts[1] && parts[2]) {
        renderDeck(topics, parts[1], parts[2]);
      } else if (parts[0] === "study" && parts[1] && parts[2]) {
        renderStudy(topics, parts[1], parts[2]);
      } else {
        renderHome(topics);
      }
    });
  }

  // ---------------- Data loading ----------------

  function loadTopics() {
    if (topicsCache) return Promise.resolve(topicsCache);
    return fetch("data/topics.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        topicsCache = data;
        return data;
      });
  }

  function loadDeckCards(deck) {
    if (!deck.dataFile) return Promise.resolve([]);
    if (deckDataCache[deck.dataFile]) return Promise.resolve(deckDataCache[deck.dataFile]);
    return fetch(deck.dataFile)
      .then(function (r) { return r.json(); })
      .then(function (cards) {
        deckDataCache[deck.dataFile] = cards;
        return cards;
      });
  }

  function findTopic(topics, topicId) {
    return topics.find(function (t) { return t.id === topicId; });
  }
  function findDeck(topic, deckId) {
    return topic.decks.find(function (d) { return d.id === deckId; });
  }

  function cardStages(card) {
    return [card.t, card.e, card.d, card.x].filter(function (s) {
      return s && String(s).trim().length > 0;
    });
  }

  // ---------------- Rendering helpers ----------------

  function el(tag, opts) {
    var node = document.createElement(tag);
    opts = opts || {};
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined) node.textContent = opts.text;
    if (opts.html !== undefined) node.innerHTML = opts.html;
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (k) { node.setAttribute(k, opts.attrs[k]); });
    }
    if (opts.onclick) node.addEventListener("click", opts.onclick);
    return node;
  }

  function topBar(title, subtitle, backPath) {
    var bar = el("div", { className: "topbar" });
    var back = el("button", { className: "back-btn", text: "‹", attrs: { "aria-label": "Back" } });
    back.addEventListener("click", function () { navigate(backPath); });
    bar.appendChild(back);
    var titleWrap = el("div");
    titleWrap.appendChild(el("h1", { text: title }));
    if (subtitle) titleWrap.appendChild(el("div", { className: "subtitle", text: subtitle }));
    bar.appendChild(titleWrap);
    return bar;
  }

  function clearApp() {
    app.innerHTML = "";
  }

  // ---------------- Home ----------------

  function renderHome(topics) {
    clearApp();
    var page = el("div", { className: "page" });
    var hero = el("div", { className: "hero" });
    hero.appendChild(el("h1", { text: "Study" }));
    hero.appendChild(el("p", { text: "Pick a topic to see its decks." }));
    page.appendChild(hero);

    var grid = el("div", { className: "folder-grid" });
    topics.forEach(function (topic) {
      var deckCount = (topic.decks || []).filter(function (d) { return !d.comingSoon; }).length;
      var disabled = !!topic.comingSoon;
      var card = el("button", {
        className: "folder-card" + (disabled ? " disabled" : ""),
      });
      card.appendChild(el("div", { className: "folder-icon", text: "📁" }));
      var info = el("div", { className: "folder-info" });
      info.appendChild(el("div", { className: "name", text: topic.name }));
      info.appendChild(el("div", {
        className: "meta",
        text: topic.subtitle ? topic.subtitle : ""
      }));
      card.appendChild(info);
      if (disabled) {
        card.appendChild(el("span", { className: "badge", text: "Coming soon" }));
      } else {
        card.appendChild(el("span", { className: "badge", text: deckCount + (deckCount === 1 ? " deck" : " decks") }));
        card.appendChild(el("span", { className: "chevron", text: "›" }));
        card.addEventListener("click", function () { navigate("/topic/" + encodeURIComponent(topic.id)); });
      }
      grid.appendChild(card);
    });
    page.appendChild(grid);
    app.appendChild(page);
  }

  // ---------------- Topic (deck list) ----------------

  function renderTopic(topics, topicId) {
    var topic = findTopic(topics, topicId);
    clearApp();
    if (!topic) { navigate("/"); return; }
    var page = el("div", { className: "page" });
    page.appendChild(topBar(topic.name, topic.subtitle, "/"));

    var grid = el("div", { className: "folder-grid" });
    grid.style.marginTop = "8px";

    if (!topic.decks || topic.decks.length === 0) {
      var empty = el("div", { className: "empty-state" });
      empty.appendChild(el("div", { className: "icon", text: "📦" }));
      empty.appendChild(el("p", { text: topic.note || "No decks here yet." }));
      page.appendChild(empty);
      app.appendChild(page);
      return;
    }

    topic.decks.forEach(function (deck) {
      var disabled = !!deck.comingSoon;
      var card = el("button", { className: "folder-card" + (disabled ? " disabled" : "") });
      card.appendChild(el("div", { className: "folder-icon", text: "🎯" }));
      var info = el("div", { className: "folder-info" });
      info.appendChild(el("div", { className: "name", text: deck.name }));
      info.appendChild(el("div", { className: "meta", text: disabled ? (deck.note || "Coming soon") : (deck.subtitle || "") }));
      card.appendChild(info);
      if (disabled) {
        card.appendChild(el("span", { className: "badge", text: "Coming soon" }));
      } else {
        card.appendChild(el("span", { className: "chevron", text: "›" }));
        card.addEventListener("click", function () {
          navigate("/deck/" + encodeURIComponent(topic.id) + "/" + encodeURIComponent(deck.id));
        });
      }
      grid.appendChild(card);
    });

    page.appendChild(grid);
    app.appendChild(page);
  }

  // ---------------- Deck listing ----------------

  function renderDeck(topics, topicId, deckId) {
    var topic = findTopic(topics, topicId);
    if (!topic) { navigate("/"); return; }
    var deck = findDeck(topic, deckId);
    if (!deck) { navigate("/topic/" + encodeURIComponent(topicId)); return; }

    clearApp();
    var page = el("div", { className: "page" });
    page.appendChild(topBar(deck.name, topic.name, "/topic/" + encodeURIComponent(topicId)));

    var loadingMsg = el("p", { text: "Loading…", className: "empty-state" });
    page.appendChild(loadingMsg);
    app.appendChild(page);

    loadDeckCards(deck).then(function (cards) {
      page.removeChild(loadingMsg);

      var header = el("div", { className: "deck-header" });
      header.appendChild(el("div", { className: "count", text: cards.length + " cards" }));
      page.appendChild(header);

      var studyBtn = el("button", { className: "study-btn", text: "Study" });
      studyBtn.addEventListener("click", function () {
        navigate("/study/" + encodeURIComponent(topicId) + "/" + encodeURIComponent(deckId));
      });
      page.appendChild(studyBtn);

      var list = el("ul", { className: "card-list" });
      cards.forEach(function (card) {
        var li = el("li");
        li.appendChild(el("div", { className: "term", text: card.t }));
        if (card.e) li.appendChild(el("div", { className: "expansion", text: card.e }));
        list.appendChild(li);
      });
      page.appendChild(list);
    });
  }

  // ---------------- Study ----------------

  function renderStudy(topics, topicId, deckId) {
    var topic = findTopic(topics, topicId);
    if (!topic) { navigate("/"); return; }
    var deck = findDeck(topic, deckId);
    if (!deck) { navigate("/topic/" + encodeURIComponent(topicId)); return; }

    clearApp();
    var page = el("div", { className: "page study-wrap" });
    page.appendChild(topBar("Study", deck.name, "/deck/" + encodeURIComponent(topicId) + "/" + encodeURIComponent(deckId)));

    var body = el("div", { className: "study-wrap" });
    body.appendChild(el("p", { text: "Loading…", className: "empty-state" }));
    page.appendChild(body);
    app.appendChild(page);

    loadDeckCards(deck).then(function (cards) {
      body.innerHTML = "";
      if (!cards.length) {
        var empty = el("div", { className: "empty-state" });
        empty.appendChild(el("div", { className: "icon", text: "📭" }));
        empty.appendChild(el("p", { text: "This deck has no cards yet." }));
        body.appendChild(empty);
        return;
      }
      startStudySession(body, topic, deck, cards);
    });
  }

  function startStudySession(container, topic, deck, cards) {
    var totalCount = cards.length;
    var queue = cards.map(function (_, i) { return i; });
    var flipStage = 0;
    var dragging = false;
    var startX = 0, startY = 0, dx = 0, dy = 0;
    var lockedAxis = null; // 'x' | 'y' | null
    var pointerId = null;

    var progressRow = el("div", { className: "progress-row" });
    var progressBar = el("div", { className: "progress-bar" });
    var progressFill = el("div", { className: "fill" });
    progressBar.appendChild(progressFill);
    var progressCount = el("div", { className: "progress-count" });
    progressRow.appendChild(progressBar);
    progressRow.appendChild(progressCount);
    container.appendChild(progressRow);

    var stageTag = el("div", { className: "card-stage-tag" });
    container.appendChild(stageTag);

    var stack = el("div", { className: "card-stack" });
    container.appendChild(stack);

    var dotsWrap = el("div", { className: "card-stage" });
    container.appendChild(dotsWrap);

    var actions = el("div", { className: "study-actions" });
    var againBtn = el("button", { className: "again-btn" });
    againBtn.innerHTML = "↻&nbsp; Again";
    var understoodBtn = el("button", { className: "understood-btn" });
    understoodBtn.innerHTML = "✓&nbsp; Understood";
    actions.appendChild(againBtn);
    actions.appendChild(understoodBtn);
    container.appendChild(actions);

    container.appendChild(el("div", {
      className: "study-tip",
      text: "Tap card to flip · swipe left = Again · swipe right = Understood"
    }));

    var cardEl = null;
    var busy = false;

    function updateProgress() {
      var remaining = queue.length;
      var studied = totalCount - remaining;
      var pct = totalCount ? Math.round((studied / totalCount) * 100) : 0;
      progressFill.style.width = pct + "%";
      progressCount.textContent = remaining + " left · " + totalCount + " total";
    }

    function stageLabel(idx, total) {
      var labels = ["Term", "Spelled Out", "Definition", "Example"];
      return labels[idx] || ("Stage " + (idx + 1));
    }

    function renderCurrentCard() {
      stack.innerHTML = "";
      if (queue.length === 0) {
        renderComplete();
        return;
      }
      var cardIndex = queue[0];
      var card = cards[cardIndex];
      var stages = cardStages(card);
      flipStage = 0;
      busy = false;

      cardEl = el("div", { className: "study-card" });
      cardEl.setAttribute("data-flip-stage", "0");
      var content = el("div", { className: "content", text: stages[0] });
      cardEl.appendChild(content);

      var againFlag = el("div", { className: "swipe-flag again", text: "Again" });
      var understoodFlag = el("div", { className: "swipe-flag understood", text: "Understood" });
      cardEl.appendChild(againFlag);
      cardEl.appendChild(understoodFlag);

      stack.appendChild(cardEl);

      stageTag.textContent = stageLabel(0, stages.length) + (stages.length > 1 ? "  •  tap to reveal" : "");
      renderDots(stages.length, 0);
      updateProgress();

      attachGestures(cardEl, stages, content, againFlag, understoodFlag);
    }

    function renderDots(total, activeIdx) {
      dotsWrap.innerHTML = "";
      if (total <= 1) return;
      for (var i = 0; i < total; i++) {
        var dot = el("div", { className: "dot" + (i === activeIdx ? " active" : "") });
        dotsWrap.appendChild(dot);
      }
    }

    function attachGestures(cardEl, stages, content, againFlag, understoodFlag) {
      function onPointerDown(e) {
        if (busy || pointerId !== null) return;
        pointerId = e.pointerId;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        dx = 0; dy = 0;
        lockedAxis = null;
        cardEl.style.transition = "none";
        cardEl.setPointerCapture && cardEl.setPointerCapture(pointerId);
      }

      function onPointerMove(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        dx = e.clientX - startX;
        dy = e.clientY - startY;
        if (lockedAxis === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
          lockedAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }
        if (lockedAxis === "x") {
          var rot = dx / 18;
          cardEl.style.transform = "translateX(" + dx + "px) rotate(" + rot + "deg)";
          var t = Math.min(Math.abs(dx) / 110, 1);
          if (dx < 0) {
            againFlag.style.opacity = t;
            understoodFlag.style.opacity = 0;
          } else if (dx > 0) {
            understoodFlag.style.opacity = t;
            againFlag.style.opacity = 0;
          }
        }
      }

      function onPointerUp(e) {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        pointerId = null;
        cardEl.style.transition = "transform 0.25s ease";

        var THRESHOLD = 90;
        if (lockedAxis === "x" && Math.abs(dx) > THRESHOLD) {
          busy = true;
          cardEl.style.pointerEvents = "none";
          var goingRight = dx > 0;
          var flyX = goingRight ? window.innerWidth : -window.innerWidth;
          cardEl.style.transform = "translateX(" + flyX + "px) rotate(" + (dx / 18) + "deg)";
          cardEl.style.opacity = "0";
          setTimeout(function () {
            if (goingRight) {
              queue.shift(); // understood: remove from session
            } else {
              queue.push(queue.shift()); // again: move to back
            }
            renderCurrentCard();
          }, 180);
        } else {
          // snap back (not a decisive swipe)
          cardEl.style.transform = "translateX(0) rotate(0)";
          againFlag.style.opacity = 0;
          understoodFlag.style.opacity = 0;
          if (lockedAxis === null || (Math.abs(dx) < 6 && Math.abs(dy) < 6)) {
            handleTap(stages, content);
          }
        }
        lockedAxis = null;
      }

      cardEl.addEventListener("pointerdown", onPointerDown);
      cardEl.addEventListener("pointermove", onPointerMove);
      cardEl.addEventListener("pointerup", onPointerUp);
      cardEl.addEventListener("pointercancel", onPointerUp);
    }

    function handleTap(stages, content) {
      if (busy || stages.length <= 1) return;
      busy = true;
      flipStage = (flipStage + 1) % stages.length;
      content.style.opacity = 0;
      setTimeout(function () {
        content.textContent = stages[flipStage];
        cardEl.setAttribute("data-flip-stage", String(flipStage));
        content.style.opacity = 1;
        busy = false;
      }, 110);
      stageTag.textContent = stageLabel(flipStage, stages.length) +
        (flipStage === stages.length - 1 ? "  •  tap to restart" : "  •  tap to reveal");
      renderDots(stages.length, flipStage);
    }

    function swipeAway(direction) {
      // direction: 'again' (left, requeue) or 'understood' (right, remove from session)
      if (busy || !cardEl) return;
      busy = true;
      cardEl.style.pointerEvents = "none";
      cardEl.style.transition = "transform 0.25s ease";
      var goingRight = direction === "understood";
      var flyX = goingRight ? window.innerWidth : -window.innerWidth;
      cardEl.style.transform = "translateX(" + flyX + "px) rotate(" + (goingRight ? 10 : -10) + "deg)";
      cardEl.style.opacity = "0";
      setTimeout(function () {
        if (goingRight) {
          queue.shift();
        } else {
          queue.push(queue.shift());
        }
        renderCurrentCard();
      }, 180);
    }

    understoodBtn.addEventListener("click", function () { swipeAway("understood"); });
    againBtn.addEventListener("click", function () { swipeAway("again"); });

    function renderComplete() {
      container.innerHTML = "";

      var done = el("div", { className: "session-complete" });
      done.appendChild(el("div", { className: "icon", text: "🎉" }));
      done.appendChild(el("h2", { text: "Session complete" }));
      done.appendChild(el("p", { text: "You cleared all " + totalCount + " cards from this study session." }));
      var actionsWrap = el("div", { className: "actions" });
      var again = el("button", { className: "primary", text: "Study again" });
      again.addEventListener("click", function () {
        container.innerHTML = "";
        startStudySession(container, topic, deck, cards);
      });
      var back = el("button", { className: "secondary", text: "Back to deck" });
      back.addEventListener("click", function () {
        navigate("/deck/" + encodeURIComponent(topic.id) + "/" + encodeURIComponent(deck.id));
      });
      actionsWrap.appendChild(again);
      actionsWrap.appendChild(back);
      done.appendChild(actionsWrap);
      container.appendChild(done);
    }

    renderCurrentCard();
  }

  route();
})();
