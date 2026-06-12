import { useState, useEffect, useRef } from "react";

/*
  CANE — a North Queensland sugarcane empire.
  Single-file incremental. Pipeline: plant → grow → harvest → bins → haul → mill → sugar → sell.
  Save object = the `game` state. To persist later: serialize `game`, restore via setGame.
*/

// ---------- formatting ----------
const fmt = (n) => {
  if (!isFinite(n)) return "∞";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "k";
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
};
const $f = (n) => "$" + fmt(n);
const tf = (n) => fmt(n) + " t";

// ---------- upgrade tracks ----------
// cost(lvl) = base * mult^lvl ; effect descriptions are computed live
const UPG = {
  // GROWING
  land: {
    track: "grow", name: "Buy the neighbour's block",
    desc: "He's retiring to Cairns. Says he won't miss the wet. He will.",
    base: 750, mult: 1.3, max: 40, unit: "ha",
  },
  agro: {
    track: "grow", name: "Agronomy program",
    desc: "A bloke with a clipboard tells you what you already suspected, but the cane grows faster.",
    base: 250, mult: 1.18, max: 30,
  },
  irrig: {
    track: "grow", name: "Irrigation",
    desc: "Water, but on purpose.",
    base: 900, mult: 1.22, max: 25,
  },
  // HARVEST
  harv: {
    track: "harvest", name: "Harvester fleet",
    desc: "Each one costs more than your house and is treated better.",
    base: 1200, mult: 1.25, max: 30,
  },
  chopper: {
    track: "harvest", name: "Chopper drum tuning",
    desc: "Sharper blades, shorter billets, fewer arguments with the mill.",
    base: 500, mult: 1.18, max: 30,
  },
  machete: {
    track: "harvest", name: "Better cane knife",
    desc: "For when you insist on doing it yourself. Grandad managed.",
    base: 50, mult: 1.15, max: 30,
  },
  // HAULAGE
  trucks: {
    track: "haul", name: "Haul-out trucks",
    desc: "Secondhand, smells of diesel and optimism.",
    base: 1000, mult: 1.25, max: 30,
  },
  bins: {
    track: "haul", name: "Siding bin capacity",
    desc: "More bins at the siding. The cane train waits for no one, except Tuesdays.",
    base: 400, mult: 1.2, max: 35,
  },
  rail: {
    track: "haul", name: "Rail siding upgrade",
    desc: "The little cane train. Two foot gauge, zero patience. Multiplies all haulage.",
    base: 25000, mult: 2.0, max: 6,
  },
  // MILL
  crush: {
    track: "mill", name: "Crushing capacity",
    desc: "The mill agrees to take more of your cane, in writing this time.",
    base: 600, mult: 1.2, max: 30,
  },
  ccs: {
    track: "mill", name: "CCS improvement",
    desc: "Sweeter cane. The mill pays for sugar, not your feelings.",
    base: 1500, mult: 1.25, max: 25,
  },
  queue: {
    track: "mill", name: "Mill yard capacity",
    desc: "Somewhere for the cane to sit while the mill thinks about it.",
    base: 600, mult: 1.2, max: 35,
  },
  // MARKET
  coop: {
    track: "market", name: "Marketing co-op tier",
    desc: "A man in Brisbane negotiates on your behalf. Occasionally well.",
    base: 2000, mult: 1.3, max: 25,
  },
};

// one-time automation buildings
const AUTO = {
  autoPlant: {
    name: "Planting contractor", cost: 2500,
    desc: "Replants the ratoons before you notice they're gone.",
  },
  autoSell: {
    name: "Forward contract", cost: 4000,
    desc: "Sugar sells itself the moment it exists. The paperwork was extensive.",
  },
};

const TRACKS = [
  { id: "grow", label: "Growing", color: "text-lime-400" },
  { id: "harvest", label: "Harvesting", color: "text-amber-400" },
  { id: "haul", label: "Haulage", color: "text-sky-400" },
  { id: "mill", label: "Milling", color: "text-orange-400" },
  { id: "market", label: "Market", color: "text-emerald-400" },
];

// prestige farm tiers, by total shares held
const TIERS = [
  [0, "Hobby block — Mossman"],
  [5, "Family farm — Tully"],
  [15, "Proper operation — Ingham"],
  [30, "Corporate ag — Burdekin"],
  [60, "Cane baron — basically the lot"],
];

const TICKER = [
  "The wet is late. Or early. Hard to say.",
  "Mill siren went off at 6am. Nobody flinched.",
  "Cane toad on the verandah again. He pays no rent.",
  "CCS is up. The pub is quietly optimistic.",
  "A tourist asked if the cane fires are 'authentic'. They are.",
  "The cane train derailed gently. It does that.",
  "Burdekin blokes reckon their cane's taller. It is. Don't tell them.",
  "Rain on the radar. The radar has been wrong before.",
  "Someone's harvester is bogged. Not yours. Today.",
  "The agronomist said 'interesting'. That's never good.",
];

// ---------- initial save ----------
const newGame = (shares = 0, lifetimeAll = 0, resets = 0) => ({
  money: 50,
  lifetime: 0,          // earned this farm (drives prestige)
  lifetimeAll,          // earned ever
  shares,               // prestige currency, +10% each
  resets,
  planted: 2,           // hectares currently planted (max = land hectares)
  standing: 0,          // tonnes of ripe cane in the paddock
  binStock: 0,          // tonnes cut, sitting in bins
  millQueue: 0,         // tonnes at the mill yard
  sugar: 0,             // tonnes of raw sugar, unsold
  lv: Object.fromEntries(Object.keys(UPG).map((k) => [k, 0])),
  owned: { autoPlant: false, autoSell: false },
  lastTick: Date.now(),
});

// ---------- derived numbers (all per second where rates) ----------
const derive = (g) => {
  const m = 1 + 0.1 * g.shares; // prestige multiplier
  const lv = g.lv;
  const ha = 2 + 2 * lv.land;
  const yieldHa = 85 * Math.pow(1.08, lv.irrig);
  const standCap = ha * yieldHa;
  const cycleSec = 90 / Math.pow(1.15, lv.agro);
  const growRate = (standCap / cycleSec) * (ha > 0 ? g.planted / ha : 0) * m;
  const harvRate = lv.harv > 0 ? ((40 * lv.harv * Math.pow(1.15, lv.chopper)) / 3600) * m : 0;
  const tapCut = 1.5 * (1 + 0.6 * lv.machete) * m;
  const haulRate = lv.trucks > 0 ? ((30 * lv.trucks * Math.pow(1.5, lv.rail)) / 3600) * m : 0;
  const tapHaul = 8 * (1 + 0.5 * lv.trucks) * Math.pow(1.5, lv.rail) * m;
  const binCap = 60 + 40 * lv.bins;
  const queueCap = 100 + 60 * lv.queue;
  const crushRate = ((50 * (1 + 0.35 * lv.crush)) / 3600) * m;
  const ccsYield = 0.13 * (1 + 0.04 * lv.ccs);
  const price = 420 * Math.pow(1.06, lv.coop) * m;
  return { m, ha, yieldHa, standCap, cycleSec, growRate, harvRate, tapCut, haulRate, tapHaul, binCap, queueCap, crushRate, ccsYield, price };
};

const upgCost = (key, lvl) => Math.floor(UPG[key].base * Math.pow(UPG[key].mult, lvl));

// ratoon wear: harvesting h tonnes uses up this many planted hectares
const ratoonWear = (h, yieldHa) => (0.2 * h) / yieldHa;

// ---------- pure simulation step ----------
// advances pools by dt seconds; returns [newPartialState, $earned]
const advance = (g, dt) => {
  const d = derive(g);
  let { planted, standing, binStock, millQueue, sugar } = g;
  let earned = 0;

  // grow (only what's planted, only up to standing cap)
  standing = Math.min(d.standCap, standing + d.growRate * dt);

  // harvest: limited by standing cane and bin space
  if (d.harvRate > 0) {
    const cut = Math.min(d.harvRate * dt, standing, d.binCap - binStock);
    if (cut > 0) {
      standing -= cut;
      binStock += cut;
      planted = Math.max(0, planted - ratoonWear(cut, d.yieldHa));
    }
  }

  // auto-replant
  if (g.owned.autoPlant && planted < d.ha * 0.95) planted = d.ha;

  // haul: bins -> mill yard
  if (d.haulRate > 0) {
    const moved = Math.min(d.haulRate * dt, binStock, d.queueCap - millQueue);
    if (moved > 0) {
      binStock -= moved;
      millQueue += moved;
    }
  }

  // crush: mill yard -> sugar
  const crushed = Math.min(d.crushRate * dt, millQueue);
  if (crushed > 0) {
    millQueue -= crushed;
    sugar += crushed * d.ccsYield;
  }

  // forward contract: sugar sells continuously
  if (g.owned.autoSell && sugar > 0) {
    earned = sugar * d.price;
    sugar = 0;
  }

  return [{ planted, standing, binStock, millQueue, sugar }, earned];
};

export default function CaneGame() {
  const [game, setGame] = useState(() => newGame());
  const [tab, setTab] = useState("farm");
  const [incomeRate, setIncomeRate] = useState(0); // $/s, smoothed
  const [awayReport, setAwayReport] = useState(null); // { secs, earned }
  const [tickerIdx, setTickerIdx] = useState(0);
  const rateRef = useRef(0);

  // single game loop
  useEffect(() => {
    const id = setInterval(() => {
      setGame((g) => {
        const now = Date.now();
        let dt = (now - g.lastTick) / 1000;
        if (dt <= 0) return g;

        let away = null;
        if (dt > 30) {
          // came back from a sleep/background — simulate up to 8h in coarse steps
          const total = Math.min(dt, 8 * 3600);
          let s = { ...g };
          let earned = 0;
          const step = total / 120;
          for (let i = 0; i < 120; i++) {
            const [p, e] = advance(s, step);
            s = { ...s, ...p };
            earned += e;
          }
          away = { secs: total, earned };
          const next = {
            ...s,
            money: s.money + earned,
            lifetime: s.lifetime + earned,
            lifetimeAll: s.lifetimeAll + earned,
            lastTick: now,
          };
          queueMicrotask(() => setAwayReport(away));
          return next;
        }

        const [p, earned] = advance(g, dt);
        // smoothed $/s
        const k = Math.min(1, dt * 0.4);
        rateRef.current = rateRef.current * (1 - k) + (earned / dt) * k;
        return {
          ...g,
          ...p,
          money: g.money + earned,
          lifetime: g.lifetime + earned,
          lifetimeAll: g.lifetimeAll + earned,
          lastTick: now,
        };
      });
      setIncomeRate(rateRef.current);
    }, 1000 / 60);
    return () => clearInterval(id);
  }, []);

  // rotate the flavour ticker
  useEffect(() => {
    const id = setInterval(() => setTickerIdx((i) => (i + 1) % TICKER.length), 12000);
    return () => clearInterval(id);
  }, []);

  const d = derive(game);

  // ---------- actions ----------
  const plant = () => setGame((g) => ({ ...g, planted: derive(g).ha }));

  const tapHarvest = () =>
    setGame((g) => {
      const dd = derive(g);
      const cut = Math.min(dd.tapCut, g.standing, dd.binCap - g.binStock);
      if (cut <= 0) return g;
      return {
        ...g,
        standing: g.standing - cut,
        binStock: g.binStock + cut,
        planted: Math.max(0, g.planted - ratoonWear(cut, dd.yieldHa)),
      };
    });

  const tapHaul = () =>
    setGame((g) => {
      const dd = derive(g);
      const moved = Math.min(dd.tapHaul, g.binStock, dd.queueCap - g.millQueue);
      if (moved <= 0) return g;
      return { ...g, binStock: g.binStock - moved, millQueue: g.millQueue + moved };
    });

  const sellSugar = () =>
    setGame((g) => {
      if (g.sugar <= 0) return g;
      const dd = derive(g);
      const earned = g.sugar * dd.price;
      return {
        ...g,
        sugar: 0,
        money: g.money + earned,
        lifetime: g.lifetime + earned,
        lifetimeAll: g.lifetimeAll + earned,
      };
    });

  const buyUpg = (key) =>
    setGame((g) => {
      const cost = upgCost(key, g.lv[key]);
      if (g.money < cost || g.lv[key] >= UPG[key].max) return g;
      return { ...g, money: g.money - cost, lv: { ...g.lv, [key]: g.lv[key] + 1 } };
    });

  const buyAuto = (key) =>
    setGame((g) => {
      if (g.owned[key] || g.money < AUTO[key].cost) return g;
      return { ...g, money: g.money - AUTO[key].cost, owned: { ...g.owned, [key]: true } };
    });

  // ---------- prestige ----------
  const pendingShares = Math.floor(Math.sqrt(game.lifetime / 50000));
  const canPrestige = pendingShares >= 1;
  const sellFarm = () => {
    if (!canPrestige) return;
    setGame((g) =>
      newGame(g.shares + pendingShares, g.lifetimeAll, g.resets + 1)
    );
    setTab("farm");
  };
  const tierName = TIERS.reduce((acc, [n, name]) => (game.shares >= n ? name : acc), TIERS[0][1]);

  // effect summaries for the upgrade list: [current, next]
  const effectText = (key) => {
    const l = game.lv[key];
    const at = (lvl) => {
      const gg = { ...game, lv: { ...game.lv, [key]: lvl } };
      const dd = derive(gg);
      switch (key) {
        case "land": return fmt(dd.ha) + " ha";
        case "agro": return fmt(dd.cycleSec) + "s crop";
        case "irrig": return fmt(dd.yieldHa) + " t/ha";
        case "harv": return fmt(dd.harvRate * 3600) + " t/hr";
        case "chopper": return "+" + fmt((Math.pow(1.15, lvl) - 1) * 100) + "%";
        case "machete": return fmt(dd.tapCut) + " t/tap";
        case "trucks": return fmt(dd.haulRate * 3600) + " t/hr";
        case "bins": return fmt(dd.binCap) + " t bins";
        case "rail": return "×" + fmt(Math.pow(1.5, lvl)) + " haul";
        case "crush": return fmt(dd.crushRate * 3600) + " t/hr";
        case "ccs": return fmt(dd.ccsYield * 100) + "% CCS";
        case "queue": return fmt(dd.queueCap) + " t yard";
        case "coop": return $f(dd.price) + "/t";
        default: return "";
      }
    };
    return [at(l), l < UPG[key].max ? at(l + 1) : null];
  };

  // ---------- tiny UI pieces ----------
  const Bar = ({ val, cap, color }) => (
    <div className="h-2 w-full rounded-full bg-stone-700 overflow-hidden">
      <div
        className={"h-full rounded-full " + color}
        style={{ width: Math.min(100, (val / Math.max(cap, 0.0001)) * 100) + "%" }}
      />
    </div>
  );

  const Stage = ({ title, color, children }) => (
    <div className="rounded-2xl bg-stone-800 p-4 flex flex-col gap-2 shadow">
      <div className={"text-xs font-bold uppercase tracking-widest " + color}>{title}</div>
      {children}
    </div>
  );

  const BigBtn = ({ onClick, disabled, children, tone = "bg-amber-500 active:bg-amber-400 text-stone-900" }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "h-12 rounded-xl font-bold text-sm px-4 w-full transition-colors " +
        (disabled ? "bg-stone-700 text-stone-500" : tone)
      }
    >
      {children}
    </button>
  );

  const Row = ({ l, r }) => (
    <div className="flex justify-between text-sm">
      <span className="text-stone-400">{l}</span>
      <span className="font-semibold tabular-nums">{r}</span>
    </div>
  );

  const binsFull = game.binStock >= d.binCap - 0.01;
  const yardFull = game.millQueue >= d.queueCap - 0.01;
  const replantPct = d.ha > 0 ? game.planted / d.ha : 0;

  // ---------- tabs ----------
  const FarmTab = (
    <div className="flex flex-col gap-3">
      <Stage title="Paddock" color="text-lime-400">
        <Row l="Standing cane" r={tf(game.standing) + " / " + tf(d.standCap)} />
        <Bar val={game.standing} cap={d.standCap} color="bg-lime-500" />
        <Row l="Growth" r={fmt(d.growRate * 3600) + " t/hr"} />
        <Row l="Planted" r={fmt(replantPct * 100) + "% of " + fmt(d.ha) + " ha"} />
        {replantPct < 0.5 && !game.owned.autoPlant && (
          <div className="text-xs text-amber-400">Ratoons are wearing out. Cane regrows about five times, then it sulks.</div>
        )}
        <BigBtn onClick={plant} disabled={replantPct > 0.98} tone="bg-lime-600 active:bg-lime-500 text-stone-900">
          {game.owned.autoPlant ? "Contractor handles it" : "Replant ratoons"}
        </BigBtn>
      </Stage>

      <Stage title="Harvest" color="text-amber-400">
        <Row l="Bins at siding" r={tf(game.binStock) + " / " + tf(d.binCap)} />
        <Bar val={game.binStock} cap={d.binCap} color="bg-amber-500" />
        <Row l="Fleet rate" r={d.harvRate > 0 ? fmt(d.harvRate * 3600) + " t/hr" : "no harvester — by hand"} />
        {binsFull && <div className="text-xs text-rose-400">Bins backed up. Harvest stopped. The haul-out crew has been informed, twice.</div>}
        <BigBtn onClick={tapHarvest} disabled={game.standing <= 0 || binsFull}>
          Cut a row (+{fmt(d.tapCut)} t)
        </BigBtn>
      </Stage>

      <Stage title="Haul-out" color="text-sky-400">
        <Row l="Mill yard" r={tf(game.millQueue) + " / " + tf(d.queueCap)} />
        <Bar val={game.millQueue} cap={d.queueCap} color="bg-sky-500" />
        <Row l="Haulage" r={d.haulRate > 0 ? fmt(d.haulRate * 3600) + " t/hr" : "no trucks — borrow the ute"} />
        {yardFull && <div className="text-xs text-rose-400">Mill yard is chockers. Trucks queued out the gate.</div>}
        <BigBtn onClick={tapHaul} disabled={game.binStock <= 0 || yardFull} tone="bg-sky-600 active:bg-sky-500 text-stone-900">
          Run a load (+{fmt(d.tapHaul)} t)
        </BigBtn>
      </Stage>

      <Stage title="Mill & sale" color="text-orange-400">
        <Row l="Crushing" r={fmt(d.crushRate * 3600) + " t/hr @ " + fmt(d.ccsYield * 100) + "% CCS"} />
        <Row l="Raw sugar" r={tf(game.sugar)} />
        <Row l="Price" r={$f(d.price) + " / t"} />
        <BigBtn
          onClick={sellSugar}
          disabled={game.sugar <= 0 || game.owned.autoSell}
          tone="bg-emerald-600 active:bg-emerald-500 text-stone-900"
        >
          {game.owned.autoSell ? "Forward contract: selling itself" : "Sell sugar (" + $f(game.sugar * d.price) + ")"}
        </BigBtn>
      </Stage>
    </div>
  );

  const UpgradesTab = (
    <div className="flex flex-col gap-4">
      {TRACKS.map((t) => (
        <div key={t.id}>
          <div className={"text-xs font-bold uppercase tracking-widest mb-2 " + t.color}>{t.label}</div>
          <div className="flex flex-col gap-2">
            {Object.entries(UPG)
              .filter(([, u]) => u.track === t.id)
              .map(([key, u]) => {
                const lvl = game.lv[key];
                const maxed = lvl >= u.max;
                const cost = upgCost(key, lvl);
                const [cur, next] = effectText(key);
                return (
                  <button
                    key={key}
                    onClick={() => buyUpg(key)}
                    disabled={maxed || game.money < cost}
                    className={
                      "text-left rounded-2xl p-3 w-full bg-stone-800 " +
                      (maxed || game.money < cost ? "opacity-60" : "active:bg-stone-700")
                    }
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-sm">{u.name}</span>
                      <span className="text-xs text-stone-400">Lv {lvl}{maxed ? " · MAX" : ""}</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">{u.desc}</div>
                    <div className="flex justify-between mt-1.5 text-sm tabular-nums">
                      <span className="text-stone-300">
                        {cur}{next && <span className="text-stone-500"> → {next}</span>}
                      </span>
                      {!maxed && (
                        <span className={game.money >= cost ? "font-bold text-emerald-400" : "text-stone-500"}>
                          {$f(cost)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-2 text-stone-300">Automation</div>
        <div className="flex flex-col gap-2">
          {Object.entries(AUTO).map(([key, a]) => (
            <button
              key={key}
              onClick={() => buyAuto(key)}
              disabled={game.owned[key] || game.money < a.cost}
              className={
                "text-left rounded-2xl p-3 w-full bg-stone-800 " +
                (game.owned[key] || game.money < a.cost ? "opacity-60" : "active:bg-stone-700")
              }
            >
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-sm">{a.name}</span>
                <span className={"text-sm font-bold " + (game.owned[key] ? "text-lime-400" : game.money >= a.cost ? "text-emerald-400" : "text-stone-500")}>
                  {game.owned[key] ? "OWNED" : $f(a.cost)}
                </span>
              </div>
              <div className="text-xs text-stone-400 mt-0.5">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const CoopTab = (
    <div className="flex flex-col gap-3">
      <Stage title="The farm" color="text-emerald-400">
        <Row l="Operation" r={tierName} />
        <Row l="Mill shares" r={fmt(game.shares)} />
        <Row l="Production bonus" r={"+" + fmt(game.shares * 10) + "%"} />
        <Row l="Earned this farm" r={$f(game.lifetime)} />
        <Row l="Earned ever" r={$f(game.lifetimeAll)} />
        <Row l="Farms sold" r={game.resets} />
      </Stage>
      <Stage title="Sell the farm" color="text-rose-400">
        <div className="text-sm text-stone-300">
          Sell up, take mill shares, buy a bigger block down the road. Everything resets except the shares.
          Each share is a permanent +10% to all rates and prices. The bank manager calls it "consolidation".
        </div>
        <Row l="Shares on offer" r={fmt(pendingShares)} />
        {!canPrestige && (
          <div className="text-xs text-stone-500">
            Need {$f(50000)} lifetime earnings for the first share. Currently {$f(game.lifetime)}. The agent says "be patient". Easy for him.
          </div>
        )}
        <BigBtn onClick={sellFarm} disabled={!canPrestige} tone="bg-rose-600 active:bg-rose-500 text-stone-100">
          Sell the farm (+{fmt(pendingShares)} shares)
        </BigBtn>
      </Stage>
    </div>
  );

  // ---------- shell ----------
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col max-w-md mx-auto">
      {/* header */}
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-stone-900 z-10 border-b border-stone-800">
        <div className="flex justify-between items-baseline">
          <span className="text-lg font-black tracking-tight text-amber-400">CANE</span>
          <span className="text-xs text-stone-500">{tierName}</span>
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <span className="text-2xl font-black tabular-nums">{$f(game.money)}</span>
          <span className="text-sm text-emerald-400 font-semibold tabular-nums">
            {$f(incomeRate * 60)}/min
          </span>
        </div>
        <div className="text-xs text-stone-500 mt-1 truncate italic">{TICKER[tickerIdx]}</div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24">
        {tab === "farm" && FarmTab}
        {tab === "upgrades" && UpgradesTab}
        {tab === "coop" && CoopTab}
      </div>

      {/* bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-stone-800 border-t border-stone-700 flex">
        {[
          ["farm", "Farm"],
          ["upgrades", "Upgrades"],
          ["coop", "Co-op"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={
              "flex-1 h-14 text-sm font-bold " +
              (tab === id ? "text-amber-400 bg-stone-900" : "text-stone-400 active:text-stone-200")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* away report */}
      {awayReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-20 p-6">
          <div className="bg-stone-800 rounded-2xl p-5 w-full max-w-sm flex flex-col gap-3">
            <div className="text-lg font-black text-amber-400">While you were gone</div>
            <div className="text-sm text-stone-300">
              The farm carried on without you for {fmt(awayReport.secs / 60)} minutes.
              {awayReport.earned > 0
                ? " The forward contract moved " + $f(awayReport.earned) + " of sugar. Nobody mentioned it."
                : " Nothing sold itself — you'll want a forward contract for that."}
            </div>
            <BigBtn onClick={() => setAwayReport(null)}>Righto</BigBtn>
          </div>
        </div>
      )}
    </div>
  );
}

