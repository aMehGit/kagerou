'use strict'
// aaaaaadsdsqdqaaaaa
let expectedCritChance = 0;
let expectedDhChance = 0;
let expectedCritDhChance = 0;

const goodRngSound = new Howl({ src: ['overlay/sounds/good%20rng.mp3'] });
const badRngSound = new Howl({ src: ['overlay/sounds/bad%20rng.mp3'] });
let lastPlayedSound = -1; // -1 plays any, 0 plays good mp3, 1 plays bad mp3

let lastSaveId = "";
let lastKnownDuration = 0;
let shouldResetAddedData = false;

let index60 = 0;

let last60CritData = {}; //key, object pair: name (str), crit%EachSec (arr 60)
let last60DhData = {};
let last60CritDhData = {};

function addedDataResetHandler() {
  if (shouldResetAddedData) {
    index60 = 0;
    last60CritData = {};
    last60DhData = {};
    last60CritDhData = {};
    shouldResetAddedData = false;
  }
}

function initAddedData(parseData) {
  for (let i = 0; i != parseData.length; ++i) {
    const playerName = parseData[i].name;
    if (!last60CritData.hasOwnProperty(playerName)) {
      last60CritData[playerName] = new Array(60);
      last60DhData[playerName] = new Array(60);
      last60CritDhData[playerName] = new Array(60);
      for (let i = 0; i != 60; ++i) {
        last60CritData[playerName][i] = new Array(2).fill(0);
        last60DhData[playerName][i] = new Array(2).fill(0);
        last60CritDhData[playerName][i] = new Array(2).fill(0);
      }
    }
  }
}

function updateAddedData(parseData, headerDuration) {
  let durationDelta = Math.max(headerDuration - lastKnownDuration, 1);
  if (durationDelta > 60) { 
    //reset
    const keys = Object.keys(last60CritData);
    const prevIndex60 = Math.max(index60 - 1, 0);
    for (let i = 0; i != keys.length; ++i) {
      for(let j = 0; j != 60; ++j) {
        last60CritData[keys[i]][j][0] = last60CritData[keys[i]][prevIndex60][0];
        last60CritData[keys[i]][j][1] = last60CritData[keys[i]][prevIndex60][1];
        last60DhData[keys[i]][j][0] = last60DhData[keys[i]][prevIndex60][0];
        last60DhData[keys[i]][j][1] = last60DhData[keys[i]][prevIndex60][1];
        last60CritDhData[keys[i]][j][0] = last60CritDhData[keys[i]][prevIndex60][0];
        last60CritDhData[keys[i]][j][1] = last60CritDhData[keys[i]][prevIndex60][1];
      }
    }
    index60 = 0;
    durationDelta = 1;
  }
  
  for (let i = 0; i != parseData.length; ++i) {
    const playerName = parseData[i].name;
    const critCount = parseInt(parseData[i].crithits);
    const dhCount = parseInt(parseData[i].DirectHitCount);
    const critDhCount = parseInt(parseData[i].CritDirectHitCount);
    const swings = parseInt(parseData[i].swings);
    const last60CritChance = (critCount - last60CritData[playerName][index60][0]) / (swings - last60CritData[playerName][index60][1]);
    const last60DhChance = (critDhCount - last60DhData[playerName][index60][0]) / (swings - last60DhData[playerName][index60][1]);
    const last60CritDhChance = (critDhCount - last60CritDhData[playerName][index60][0]) / (swings - last60CritDhData[playerName][index60][1]);
    
    parseData[i].last60Crit = last60CritChance;
    parseData[i].last60Dh = last60DhChance;
    parseData[i].last60CritDh = last60CritDhChance;
    rngSoundHandler(last60CritChance, last60DhChance, last60CritDhChance);
    
    let index = index60;
    for (let j = 0; j != durationDelta; ++j) {
      last60CritData[playerName][index][0] = critCount;
      last60DhData[playerName][index][0] = dhCount;
      last60CritDhData[playerName][index][0] = critDhCount;
      last60CritData[playerName][index][1] = last60DhData[playerName][index][1] = last60CritDhData[playerName][index][1] = swings;
      index = (index + 1) % 60;
    }
  }
  index60 = (index60 + durationDelta) % 60;
}

function rngSoundHandler(last60CritChance, last60DhChance, last60CritDhChance) {
  const deviation = (expectedCritChance - last60CritChance) + (expectedDhChance - last60DhChance) + (expectedCritDhChance - last60CritDhChance);
  const shouldPlayGoodRngSound = (lastPlayedSound != 0) && (deviation >= 0);
  const shouldPlayBadRngSound = (lastPlayedSound != 1) && (deviation < 0);
  if (shouldPlayGoodRngSound) {
    goodRngSound.play();
    lastPlayedSound = 0;
  }
  else if (shouldPlayBadRngSound) {
    badRngSound.play();
    lastPlayedSound = 1;
  }
}

;(function() {

  const NICK_REGEX = / \(([\uac00-\ud7a3']{1,9}|[A-Z][a-z' ]{0,15})\)$/

  const toArray = o => Object.keys(o).map(_ => o[_])
  const SORTABLE = {}

  COLUMN_SORTABLE.map(_ => {
    let o = resolveDotIndex(COLUMN_INDEX, _)
    SORTABLE[_] = o.v || o
  })

  class Data {
    constructor(data) {
      // reconstruct
      this.saveid = `kagerou_save_${Date.now()}` +
          sanitize(data.Encounter.CurrentZoneName)
      
      expectedCritChance = Math.floor(200 * (window.config.get('stats.crit_points') - 380) / 3300 + 50) / 1000;
      expectedDhChance = Math.floor(550 * (window.config.get('stats.crit_points') - 380) / 3300) / 1000;
      expectedCritDhChance = expectedCritChance * expectedDhChance;
      this.update(data)
      
      this.isCurrent = true
    }

    update(data) {
      this.isActive = data.isActive
      this.header = data.Encounter
      this.data = toArray(data.Combatant)
      this.calculateMax(data.Combatant)
      
      const duration = parseInt(this.header.DURATION);
      shouldResetAddedData = (lastSaveId != this.saveid);
      
      addedDataResetHandler();
      initAddedData(this.data);
      updateAddedData(this.data, duration);
      lastSaveId = this.saveid;
      lastKnownDuration = duration;
    }

    get(sort, merged) {
      let r = this.data.slice(0)

      if(merged) {
        let players = {}
        let haveYou = r.some(_ => _.name === 'YOU')

        for(let o of r) {
          let name = o.name
          let job = (o.Job || '').toUpperCase()
          let mergeable = VALID_PLAYER_JOBS.indexOf(job) === -1
          let owner = resolveOwner(name)
          let isUser = !owner && !mergeable

          if(haveYou && window.config.get('format.myname').indexOf(owner) != -1) {
            owner = 'YOU'
          }
          owner = owner || name

          if(!players[owner]) {
            players[owner] = Object.assign({}, o)
          } else {
            let patch = {}

            // let keys = Object.keys(players[owner])
            for(let k of COLUMN_MERGEABLE) {
              let v1 = pFloat(o[k])
              let v2 = pFloat(players[owner][k])
              patch[k] = (isNaN(v1)? 0 : v1) + (isNaN(v2)? 0 : v2)
            }

            for(let t in COLUMN_USE_LARGER) {
              let targets = COLUMN_USE_LARGER[t]
              let v
              let v1 = pInt(o[t])
              let v2 = pInt(players[owner][t])

              if(v1 > v2 || isNaN(v2))
                v = o
              else if(v1 <= v2 || isNaN(v1))
                v = players[owner]

              for(let k of targets) {
                patch[k] = v[k]
              }
            }

            if(isUser) {
              players[owner] = Object.assign({}, o, patch)
            } else {
              players[owner] = Object.assign({}, players[owner], patch)
            }
          }
        }
        r = toArray(players)
      }

      r = this.sort(sort, r)

      return [r, this.calculateMax(r)]
    }

    sort(key, target) {
      let d = (('+-'.indexOf(key[0]))+1 || 1) * 2 - 3
      let k = SORTABLE[key]
      ;(target || this.data).sort((a, b) => (pFloat(a[k]) - pFloat(b[k])) * d)

      if(target) return target
    }

    calculateMax(combatant) {
      let max = {}

      for(let k in SORTABLE) {
        let v = SORTABLE[k]
        max[k] = Math.max.apply(
          Math, Object.keys(combatant).map(_ => combatant[_][v])
        )
      }

      return max
    }

    finalize() {
      this.isCurrent = false
      return this.saveid
    }

  }

  class History {

    constructor() {
      this.lastEncounter = false
      this.currentData = false
      this.history = {}
    }

    push(data) {
      if(!data || !data.Encounter || data.Encounter.hits < 1) return

      if(this.isNewEncounter(data.Encounter)) {
        if(config.get('format.myname').length === 0
        && NICK_REGEX.test(data.Encounter.title)) {
          let nick = NICK_REGEX.exec(data.Encounter.title)[1]
          config.set('format.myname', [nick])
          config.save()
        }
        if(this.currentData) {
          let id = this.currentData.finalize()
          this.history[id] = {
            id: id,
            title: this.currentData.header.title,
            region: this.currentData.header.CurrentZoneName,
            duration: this.currentData.header.duration,
            dps: this.currentData.header.damage /
                 this.currentData.header.DURATION,
            data: this.currentData
          }
        }

        this.currentData = new Data(data)

      } else {
        this.currentData.update(data)
      }
    }

    updateLastEncounter(encounter) {
      this.lastEncounter = {
        hits: encounter.hits,
        region: encounter.CurrentZoneName,
        damage: encounter.damage,
        duration: parseInt(encounter.DURATION)
      }
    }

    isNewEncounter(encounter) {
      let really = (
        !this.lastEncounter
      || this.lastEncounter.region !== encounter.CurrentZoneName
      || this.lastEncounter.duration > parseInt(encounter.DURATION)
      // ACT-side bug (scrambling data) making this invalid!
      // || this.lastEncounter.damage > encounter.damage
      // || this.lastEncounter.hits > encounter.hits
      )
      this.updateLastEncounter(encounter)
      return really
    }

    get list() { return this.history }

    get current() { return this.currentData }

    browse(id) {
      return this.history[id]
    }
  }

  window.Data = Data
  window.History = History


})()
