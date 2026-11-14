import "three";
//#region ../../../../../../../home/user/babi-life/web/src/avatar/jobs.ts
var JOB_POSES = [
	"scan",
	"cash",
	"serve",
	"cut",
	"braid",
	"inject",
	"stetho",
	"board",
	"stamp",
	"shelve",
	"pump",
	"direct",
	"carry",
	"hand",
	"mic",
	"whistle",
	"point",
	"present",
	"display"
];
var IS$2 = new Set(JOB_POSES);
var isJob = (p) => IS$2.has(p);
var up$1 = (v) => Math.max(0, v);
var ease$3 = (k) => k * k * (3 - 2 * k);
/** A hand on the hip. */
var hip = (out) => [
	.25,
	0,
	out * .6,
	-1.6,
	0
];
function jobArms(pose, out, t) {
	if (!isJob(pose)) return null;
	const right = out > 0;
	switch (pose) {
		case "scan": {
			const k = t * 1.3 % 1;
			const sweep = ease$3(Math.min(1, k / .55));
			return right ? [
				-1.05,
				0,
				-.35 + sweep * .75,
				-1 + sweep * .25,
				0
			] : [
				-.85,
				0,
				out * .05,
				-1.25,
				0
			];
		}
		case "cash": return right ? [
			-.95,
			0,
			.02,
			-1.4 + up$1(Math.sin(t * 9)) * .16,
			Math.sin(t * 9) * .15
		] : [
			-1,
			0,
			out * -.2,
			-1.5,
			0
		];
		case "serve": {
			const k = up$1(Math.sin(t * 1.4));
			return right ? [
				-.55 - k * .6,
				0,
				.12,
				-.6 - k * .35,
				0
			] : [
				-1.15,
				0,
				out * .35,
				-1.65,
				0
			];
		}
		case "cut": return right ? [
			-2 + Math.sin(t * 2) * .12,
			0,
			.25,
			-1.25 + Math.sin(t * 12) * .14,
			Math.sin(t * 12) * .2
		] : [
			-1.85,
			0,
			out * .3,
			-1.55,
			0
		];
		case "braid": {
			const s = Math.sin(t * 5 + (right ? 0 : Math.PI));
			return [
				-1.75 + s * .18,
				0,
				out * .18,
				-1.45 - s * .12,
				s * .4
			];
		}
		case "inject": {
			const k = t * .6 % 1;
			return right ? [
				-1.2,
				0,
				.08,
				-.75 - ease$3(k) * .3,
				0
			] : [
				-1.05,
				0,
				out * -.15,
				-.85,
				0
			];
		}
		case "stetho": return right ? [
			-1.3 + Math.sin(t * .9) * .08,
			0,
			.05 + Math.sin(t * .7) * .1,
			-.7,
			0
		] : [
			-1.25,
			0,
			out * .4,
			-2.3,
			0
		];
		case "board": return right ? [
			-2.45 + Math.sin(t * 2.5) * .1,
			0,
			.3 + Math.sin(t * 7) * .12,
			-.35 + Math.sin(t * 9) * .06,
			0
		] : [
			-.7,
			0,
			out * .12,
			-1.45,
			0
		];
		case "stamp": {
			const k = t * 1.5 % 1;
			const lift = k < .65 ? ease$3(k / .65) : 1 - ease$3(Math.min(1, (k - .65) / .12));
			return right ? [
				-.95 - lift * .85,
				0,
				.15,
				-1.2 + lift * .45,
				0
			] : [
				-.75,
				0,
				out * .08,
				-.95,
				0
			];
		}
		case "shelve": {
			const reach = up$1(Math.sin(t * 2.2 + (right ? 0 : Math.PI)));
			return [
				-.85 - reach * 1.35,
				0,
				out * .15,
				-1.15 + reach * .85,
				0
			];
		}
		case "pump": return right ? [
			-.8,
			0,
			.22,
			-.55 - up$1(Math.sin(t * 4)) * .08,
			0
		] : hip(out);
		case "direct": return right ? [
			-.15,
			0,
			1.5,
			-.05,
			0
		] : [
			-1.35 + Math.sin(t * 3.2) * .55,
			0,
			out * .2,
			-.5 + Math.sin(t * 3.2) * .35,
			0
		];
		case "carry": return [
			-.85 + Math.sin(t * 2.4) * .03,
			0,
			out * -.08,
			-1.15,
			0
		];
		case "hand": {
			const k = up$1(Math.sin(t * 1.3));
			return right ? [
				-.45 - k * .85,
				0,
				.1,
				-1.15 + k * .85,
				0
			] : [
				-.25,
				0,
				out * .1,
				-.45,
				0
			];
		}
		case "mic": return right ? [
			-1.3,
			0,
			.32,
			-2.2,
			0
		] : [
			-1 - up$1(Math.sin(t * 2.6)) * .4,
			0,
			out * (.55 + up$1(Math.sin(t * 2.6)) * .3),
			-.4,
			0
		];
		case "whistle": return right ? [
			-1.3,
			0,
			.3,
			-2.3 + up$1(Math.sin(t * 3)) * .06,
			0
		] : hip(out);
		case "point": return right ? [
			-1.4 + Math.sin(t * 1.1) * .06,
			0,
			.55 + Math.sin(t * .6) * .15,
			-.12,
			0
		] : [
			.02,
			0,
			out * .12,
			-.25,
			0
		];
		case "present": {
			const k = up$1(Math.sin(t * 1.6));
			return [
				-.55 - k * .2,
				0,
				out * (.75 + k * .2),
				-.55,
				out * .3
			];
		}
		case "display": return [
			-1.55 + Math.sin(t * 1.2) * .08,
			0,
			out * .28,
			-.65,
			0
		];
	}
	return null;
}
/** The head: looking at what the hands do (positive, down), or up at the board, the shelf, the client's hair. */
function jobHead(pose, t) {
	if (!isJob(pose)) return void 0;
	switch (pose) {
		case "board":
		case "shelve": return -.2;
		case "cut":
		case "braid": return .05 + Math.sin(t * .8) * .05;
		case "mic":
		case "whistle":
		case "direct":
		case "present":
		case "point": return -.05;
		default: return .28;
	}
}
//#endregion
//#region stubs/react.js
var cur = null;
var withInstance = (inst, fn) => {
	cur = inst;
	inst.i = 0;
	try {
		return fn();
	} finally {
		cur = null;
	}
};
var useRef = (v) => {
	if (!cur) return { current: v };
	const k = cur.i++;
	return cur.refs[k] ??= { current: v };
};
//#endregion
//#region stubs/fiber.js
var cbs = [];
var useFrame = (cb) => {
	cbs.push(cb);
};
var takeFrames = () => {
	const c = cbs;
	cbs = [];
	return c;
};
//#endregion
//#region ../../../../../../../home/user/babi-life/web/src/lib/worldClock.ts
/** The game's epoch (Monday 1 January 2024, UTC), as on the server. */
var EPOCH_MS = Date.UTC(2024, 0, 1);
/** A clock that never goes back (Date.now can jump when the phone resyncs). */
var origin = performance.timeOrigin ?? Date.now() - performance.now();
var local = () => origin + performance.now();
var offset = 0;
/** Now, on the server's clock (ms since 1970). */
var serverNow = () => local() + offset;
var frozen = null;
/** Holds the shared clock at one instant (null lets it run): for rendering a video frame by frame. */
function freezeWorldTime(t) {
	frozen = t;
}
/** Seconds since the game's epoch on the shared clock: what animations read. */
var worldTime = () => frozen ?? (serverNow() - EPOCH_MS) / 1e3;
//#endregion
//#region ../../../../../../../home/user/babi-life/web/src/avatar/emotes.ts
var EMOTE_POSES = [
	"clap",
	"thumbsup",
	"shrug",
	"laugh",
	"dab",
	"heart",
	"salute",
	"facepalm",
	"cry",
	"kiss",
	"bow",
	"flex",
	"zouglou",
	"gweta",
	"robot",
	"moonwalk",
	"kneeslide",
	"meditate",
	"shout",
	"sitground",
	"lean",
	"cache",
	"coucou"
];
var IS$1 = new Set(EMOTE_POSES);
var isEmote = (p) => IS$1.has(p);
/** The fast ones: the joints follow closely. */
var EMOTE_SNAPPY = /* @__PURE__ */ new Set([
	"clap",
	"zouglou",
	"gweta",
	"robot",
	"moonwalk",
	"shout"
]);
var up = (v) => Math.max(0, v);
var ease$2 = (k) => k * k * (3 - 2 * k);
var clamp01$2 = (v) => Math.min(1, Math.max(0, v));
/** The body bent forward from the hips (0.84 m up), the hips staying where they are. */
/** Sobbing comes in waves: stronger, then catching the breath. */
var sobs = (t) => .55 + .45 * Math.sin(t * .9);
var lean = (rx) => ({
	y: .84 - .84 * Math.cos(rx),
	z: -.84 * Math.sin(rx),
	rx
});
/** Brushing the teeth: 7 s brushing, then 3 s bent over the basin rinsing; again (from when it started). */
var rinsing = (since) => since % 10 > 7;
/** On the toilets: scrolling the phone, now and then a look up from it. */
var lookingUp = (since) => since % 13 > 9.5;
function armsOf(pose, out, t, since) {
	const right = out > 0;
	switch (pose) {
		case "brush":
			if (rinsing(since)) return right ? [
				-.35,
				0,
				.12,
				-.6,
				0
			] : [
				-1.15,
				0,
				-.32,
				-2.05,
				0
			];
			return right ? [
				-1.3,
				Math.sin(t * 13) * .16,
				.3,
				-2.1,
				0
			] : [
				-.7,
				0,
				-.18,
				-1.5,
				0
			];
		case "toilet":
			if (right) return [
				-.5 + Math.sin(t * 2.1) * .03,
				0,
				-.08,
				-1.2 - (lookingUp(since) ? 0 : Math.sin(t * 5) * .03),
				0
			];
			return [
				-.6,
				0,
				-.06,
				-.85,
				0
			];
		case "clap": {
			const k = .5 + .5 * Math.sin(t * 11 + Math.sin(t * 1.3) * .8);
			return [
				-1.25 - k * .08 * (.5 + .5 * Math.sin(t * .7)),
				0,
				out * (.18 - .42 * k),
				-1.15,
				0
			];
		}
		case "thumbsup": return right ? [
			-1,
			0,
			.25,
			-1.6,
			0
		] : [
			0,
			0,
			out * .1,
			-.1,
			0
		];
		case "shrug": return [
			-.35,
			0,
			out * (.7 + up(Math.sin(t * 3)) * .12),
			-1.7,
			0
		];
		case "laugh": return [
			-.35,
			0,
			out * -.15,
			-1.9,
			0
		];
		case "dab": return right ? [
			-2.5,
			0,
			.9,
			0,
			0
		] : [
			-1.55,
			0,
			-.75,
			-2,
			0
		];
		case "heart": return [
			-2.8,
			0,
			out * .35,
			-1.5,
			0
		];
		case "salute": return right ? [
			-1.2,
			0,
			1,
			-2.3,
			0
		] : [
			0,
			0,
			out * .08,
			-.1,
			0
		];
		case "facepalm": return right ? [
			-1.5,
			0,
			-.25,
			-2.4,
			0
		] : [
			-.3,
			0,
			out * .1,
			-1.2,
			0
		];
		case "cry": return [
			-1.45,
			0,
			out * -.2,
			-2.45 + Math.sin(t * 14 + out) * .08 * sobs(t),
			0
		];
		case "kiss": {
			if (!right) return [
				0,
				0,
				out * .1,
				-.2,
				0
			];
			const k = since * .8 % 1;
			const e = k < .4 ? 0 : k < .6 ? ease$2((k - .4) / .2) : 1 - ease$2(clamp01$2((k - .7) / .3));
			return [
				-1.4 - e * .5,
				0,
				.2 + e * .3,
				-2.4 + e * 2,
				0
			];
		}
		case "bow": return right ? [
			-.9,
			0,
			-.35,
			-1.6,
			0
		] : [
			.4,
			0,
			out * .1,
			-.6,
			0
		];
		case "flex": return [
			-1.5,
			0,
			out * .95,
			-1.9 - Math.abs(Math.sin(t * 4)) * .25,
			0
		];
		case "zouglou": return [
			-.6 - .5 * Math.sin(t * 6 + (right ? 0 : Math.PI)),
			0,
			out * .25,
			-1.2,
			0
		];
		case "gweta": return [
			-.7 + Math.sin(t * 18 + out) * .18,
			0,
			out * .45,
			-1.5,
			0
		];
		case "robot": {
			const q = (Math.floor(t * 2) + (right ? 0 : 2)) % 4;
			return [
				[
					-1.57,
					0,
					-1.57,
					-.8
				][q],
				0,
				out * .15,
				[
					-1.57,
					-.2,
					0,
					-1.57
				][q],
				0
			];
		}
		case "moonwalk": return [
			Math.sin(t * Math.PI * 2) * .2 * out,
			0,
			out * .15,
			-.3,
			0
		];
		case "kneeslide": return [
			-.4,
			0,
			out * 2.3,
			-.1,
			0
		];
		case "meditate": return [
			-.6,
			0,
			out * .35,
			-.5,
			0
		];
		case "sitground": return [
			.6,
			0,
			out * .32,
			-.05,
			0
		];
		case "lean": return [
			-.35,
			0,
			out * -.18,
			-1.75,
			0
		];
		case "cache": return [
			-1.55,
			0,
			out * -.55,
			-2.25,
			0
		];
		case "coucou": return [
			-1.25,
			0,
			out * .95,
			-1.7,
			0
		];
		case "shout": return right ? [
			-1.45,
			0,
			.15,
			-2.35,
			0
		] : [
			-.3,
			0,
			out * (2.2 + up(Math.sin(t * 6)) * .4),
			-.3,
			0
		];
		default: return null;
	}
}
function legsOf(pose, out, t) {
	const side = out > 0 ? 0 : Math.PI;
	switch (pose) {
		case "zouglou": {
			const k = up(Math.sin(t * 6 + side));
			return [
				-.25 - .15 * k,
				0,
				.5 + .35 * k
			];
		}
		case "gweta": return [
			-.2 + Math.sin(t * 9 + side) * .08,
			out * .06,
			.45
		];
		case "moonwalk": {
			const k = up(Math.sin(t * Math.PI * 2 + side));
			return [
				.05 + .1 * Math.sin(t * Math.PI * 2 + side),
				0,
				.6 * k
			];
		}
		case "kneeslide":
		case "cache":
		case "coucou": return [
			.05,
			out * .08,
			1.55
		];
		case "meditate": return [
			-1.45,
			out * .9,
			2.3
		];
		case "sitground": return [
			-1.95,
			out * .14,
			1.95
		];
		case "lean": return out > 0 ? [
			.45,
			out * .05,
			1.25
		] : [
			.05,
			out * .04,
			.05
		];
		case "bow": return [
			0,
			0,
			.05
		];
		case "shout": return [
			-.1,
			0,
			.15 + up(-Math.sin(t * 6)) * .4
		];
		default: return null;
	}
}
function bodyOf(pose, t, since) {
	switch (pose) {
		case "brush":
			if (rinsing(since)) {
				const k = Math.min(1, since % 10 - 7) * Math.min(1, (10 - since % 10) * 2);
				return {
					...lean(.55 * k),
					head: -.1 * k
				};
			}
			return {
				head: -.08 + Math.sin(t * 13) * .02,
				ry: Math.sin(t * .7) * .06
			};
		case "toilet": return {
			y: -.41,
			rx: .22,
			head: lookingUp(since) ? -.05 : .42,
			ry: lookingUp(since) ? Math.sin(t * .9) * .3 : 0
		};
		case "clap": return { head: -.05 };
		case "thumbsup": return { head: -.1 };
		case "shrug": return {
			y: up(Math.sin(t * 3)) * .03,
			head: .05,
			rz: Math.sin(t * 1.5) * .04
		};
		case "laugh": return {
			y: -.03,
			rx: .15 + Math.abs(Math.sin(t * 9)) * .1,
			head: -.25 + Math.sin(t * 9) * .1
		};
		case "dab": return {
			rz: -.15,
			ry: .3,
			head: .45
		};
		case "heart": return { head: -.2 };
		case "salute": return { head: -.05 };
		case "facepalm": return {
			rx: .1,
			head: .35
		};
		case "cry": return {
			y: -.02 - sobs(t) * .015 * Math.abs(Math.sin(t * 7)),
			rx: .12 + sobs(t) * .04,
			head: .4 + Math.sin(t * 5) * .05 * sobs(t)
		};
		case "kiss": return { head: -.1 };
		case "bow": {
			const k = since * .45 % 1;
			return {
				...lean(.85 * Math.sin(k * Math.PI)),
				head: .3
			};
		}
		case "flex": return {
			y: -.04,
			head: -.1
		};
		case "zouglou": return {
			y: -.08 - Math.abs(Math.sin(t * 6)) * .05,
			rx: .18,
			ry: Math.sin(t * 3) * .25
		};
		case "gweta": return {
			y: -.12,
			rx: .1,
			rz: Math.sin(t * 9) * .12,
			ry: Math.sin(t * 4.5) * .2
		};
		case "robot": return {
			ry: [
				0,
				.5,
				0,
				-.5
			][Math.floor(t * 2) % 4],
			head: 0
		};
		case "moonwalk":
			const k = since / 4 % 1;
			return {
				z: .6 - (k < .75 ? k / .75 : 1 - ease$2((k - .75) / .25)) * 1.2,
				rx: -.05,
				head: -.05 + Math.sin(t * Math.PI * 2) * .03
			};
		case "kneeslide": return {
			y: -.4,
			rx: -.3,
			head: -.4
		};
		case "cache": return {
			y: -.4,
			rx: .12,
			head: .12
		};
		case "coucou": return {
			y: -.4,
			rx: -.08,
			head: -.12
		};
		case "meditate": return {
			y: -.62 + Math.sin(t * 1.5) * .03,
			head: .15
		};
		case "sitground": return {
			y: -.62,
			rx: -.2,
			ry: Math.sin(t * .25) * .15,
			head: .1 + Math.sin(t * .4) * .06
		};
		case "lean": return {
			y: -.03,
			z: -.05,
			rx: -.1,
			head: -.04 + Math.sin(t * .3) * .05
		};
		case "shout": return {
			y: up(Math.sin(t * 6)) * .1,
			rx: .15,
			head: -.1
		};
		default: return null;
	}
}
/** The emotes that loop a move; the others strike a pose and hold it. */
var LOOPED = /* @__PURE__ */ new Set([
	"clap",
	"shrug",
	"laugh",
	"cry",
	"kiss",
	"bow",
	"flex",
	"zouglou",
	"gweta",
	"robot",
	"moonwalk",
	"shout",
	"brush",
	"toilet"
]);
var REST = [
	0,
	0,
	.1,
	-.12,
	0
];
/** 0 → 1 over `d` seconds, going about 8 % past the end and back. */
var overshoot = (since, d) => {
	const k = clamp01$2(since / d) - 1;
	return 1 + 2.2 * k * k * k + 1.2 * k * k;
};
/** A bump: 0, up to 1 around `at`, 0 again. */
var bump = (since, at, w) => Math.exp(-(((since - at) / w) ** 2));
function emoteArms(pose, out, t, since) {
	const a = armsOf(pose, out, t, since);
	if (!a || LOOPED.has(pose)) return a;
	const e = overshoot(since, .45);
	const rest = [
		REST[0],
		REST[1],
		out * REST[2],
		REST[3],
		REST[4]
	];
	const breathe = Math.sin(t * 1.7) * .035;
	const lift = clamp01$2(since / .2);
	return [
		rest[0] + (a[0] - rest[0]) * e * (.6 + .4 * lift) + breathe,
		a[1],
		rest[2] + (a[2] - rest[2]) * Math.min(1.05, e * 1.25),
		rest[3] + (a[3] - rest[3]) * e - breathe * .6,
		a[4]
	];
}
function emoteLegs(pose, out, t, since = 1) {
	const l = legsOf(pose, out, t);
	const dip = bump(since, .1, .1) * .22;
	if (l) return [
		l[0] - dip * .5,
		l[1],
		l[2] + dip
	];
	if (!isEmote(pose)) return null;
	const shift = Math.sin(t * .8) * out;
	return [
		-dip * .5,
		out * .02,
		dip + Math.max(0, -shift) * .1
	];
}
function emoteBody(pose, t, since) {
	const b = bodyOf(pose, t, since);
	if (!b && !isEmote(pose)) return null;
	const body = { ...b };
	body.y = (body.y ?? 0) - bump(since, .1, .1) * .05 + Math.sin(t * 1.7) * .006;
	if (!LOOPED.has(pose)) {
		body.rz = (body.rz ?? 0) + Math.sin(t * .8) * .025;
		body.head = (body.head ?? 0) + bump(since, .5, .15) * .08 + Math.sin(t * 1.1) * .02;
	}
	return body;
}
//#endregion
//#region ../../../../../../../home/user/babi-life/web/src/avatar/fight.ts
var FIGHT_POSES = [
	"fstance",
	"fwalk",
	"fback",
	"fcrouch",
	"fjump",
	"jab",
	"cross",
	"uppercut",
	"highkick",
	"lowpunch",
	"sweep",
	"airpunch",
	"airkick",
	"fblock",
	"flowblock",
	"fhit",
	"fhitlow",
	"fair",
	"fdown",
	"fgetup",
	"fko",
	"fgrab",
	"fthrown",
	"fsuper",
	"fdash"
];
var IS = new Set(FIGHT_POSES);
var isFight = (p) => IS.has(p);
var clamp01$1 = (x) => Math.max(0, Math.min(1, x));
var ease$1 = (x) => x * x * (3 - 2 * x);
/** Out to a move's full reach and back: up over `a` s, held till `b`, back by `c`. */
var reach = (since, a, b, c) => since < a ? ease$1(since / a) : since < b ? 1 : 1 - ease$1(clamp01$1((since - b) / (c - b)));
var mix = (p, q, k) => p.map((v, i) => v + (q[i] - v) * k);
var GUARD_LEAD = [
	-1.05,
	0,
	-.32,
	-1.85,
	0
];
var GUARD_REAR = [
	-.8,
	0,
	-.38,
	-2.2,
	0
];
var guard = (out) => (out < 0 ? GUARD_LEAD : GUARD_REAR).map((v, i) => i === 2 ? v * out : v);
var stanceLeg = (out, t) => {
	const b = Math.sin(t * 7) * .05;
	return out < 0 ? [
		-.38,
		out * .06,
		.42 + b
	] : [
		.3,
		out * .1,
		.34 + b
	];
};
var crouchLeg = (out) => out < 0 ? [
	-1.35,
	out * .12,
	2
] : [
	-.9,
	out * .18,
	2.2
];
function fightLegs(pose, out, t, since) {
	switch (pose) {
		case "fstance":
		case "fblock":
		case "jab":
		case "cross":
		case "fgrab": return stanceLeg(out, t);
		case "fwalk":
		case "fback":
		case "fdash": {
			const k = Math.sin(t * (pose === "fdash" ? 18 : 10) + (out < 0 ? 0 : 1.6));
			const [h, z, kn] = stanceLeg(out, t);
			return [
				h + k * .16 * (pose === "fback" ? -1 : 1),
				z,
				kn + Math.max(0, k) * .25
			];
		}
		case "fcrouch":
		case "flowblock":
		case "lowpunch": return crouchLeg(out);
		case "fjump":
		case "airpunch": return [
			-1.1,
			out * .1,
			1.7
		];
		case "airkick": return out < 0 ? [
			-1.25 * reach(since, .08, .5, .7),
			out * .1,
			.1 + 1.4 * (1 - reach(since, .08, .5, .7))
		] : [
			-.6,
			out * .1,
			1.8
		];
		case "uppercut": {
			const k = clamp01$1(since / .11);
			const [h, z, kn] = stanceLeg(out, t);
			return [
				h - (1 - k) * .35,
				z,
				kn + (1 - k) * .55
			];
		}
		case "highkick": {
			if (out < 0) return [
				-.2,
				-.05,
				.25
			];
			const e = reach(since, .15, .24, .5);
			const chamber = since < .15 ? ease$1(since / .15) : 1 - e;
			return [
				.3 - 1.95 * Math.max(e, chamber * .7),
				out * (.15 + .55 * e),
				.35 + 1.5 * chamber * (1 - e) + .05
			];
		}
		case "sweep": {
			if (out < 0) return [
				-1.4,
				-.1,
				2.1
			];
			const e = reach(since, .13, .23, .5);
			return [
				-.2 - 1.15 * e,
				out * (.3 + .7 * e),
				.6 * (1 - e) + .05
			];
		}
		case "fhit": return out < 0 ? [
			-.15,
			out * .08,
			.3
		] : [
			.35,
			out * .1,
			.45
		];
		case "fhitlow": return [
			-.4,
			out * .08,
			.7
		];
		case "fair":
		case "fthrown": return [
			-.8 + Math.sin(since * 14 + out) * .25,
			out * .25,
			.6
		];
		case "fdown":
		case "fko": return out < 0 ? [
			-.05,
			out * .18,
			.1
		] : [
			-.45,
			out * .14,
			.8
		];
		case "fgetup": {
			const k = ease$1(clamp01$1(since / .4));
			return mix([
				-1.4,
				out * .15,
				2
			], stanceLeg(out, t), k);
		}
		case "fsuper": {
			const k = Math.sin(since * 22 + (out < 0 ? 0 : Math.PI));
			return [
				-.35 + k * .45,
				out * .08,
				.5 + Math.max(0, -k) * .8
			];
		}
		default: return null;
	}
}
function fightArms(pose, out, _t, since) {
	const lead = out < 0;
	switch (pose) {
		case "fstance":
		case "fwalk":
		case "fback":
		case "fcrouch":
		case "fdash":
		case "fjump": return guard(out);
		case "jab": {
			if (!lead) return guard(out);
			const e = reach(since, .06, .12, .25);
			return mix(guard(out), [
				-1.6,
				0,
				-.12 * out,
				-.05,
				0
			], e);
		}
		case "cross": {
			if (lead) return mix(guard(out), [
				-.7,
				0,
				-.35 * out,
				-2.3,
				0
			], reach(since, .08, .15, .33));
			const e = reach(since, .08, .15, .33);
			return mix(guard(out), [
				-1.6,
				0,
				-.32 * out,
				-.05,
				0
			], e);
		}
		case "uppercut": {
			if (lead) return guard(out);
			if (since < .11) return mix(guard(out), [
				-.35,
				0,
				-.2 * out,
				-1.95,
				0
			], ease$1(since / .11));
			const e = reach(since - .11, .07, .15, .4);
			return mix([
				-.35,
				0,
				-.2 * out,
				-1.95,
				0
			], [
				-2.55,
				0,
				-.25 * out,
				-1.2,
				0
			], e);
		}
		case "highkick":
		case "airkick": return lead ? [
			-1.2,
			0,
			-.2 * out,
			-1.7,
			0
		] : [
			.35,
			0,
			.6 * out,
			-.6,
			0
		];
		case "lowpunch": {
			if (!lead) return guard(out);
			const e = reach(since, .06, .12, .26);
			return mix(guard(out), [
				-1.25,
				0,
				-.1 * out,
				-.05,
				0
			], e);
		}
		case "sweep": return lead ? [
			-.55,
			0,
			.35 * out,
			-.15,
			0
		] : guard(out);
		case "airpunch":
			if (!lead) return guard(out);
			return mix(guard(out), [
				-1.2,
				0,
				-.12 * out,
				-.05,
				0
			], reach(since, .05, .3, .45));
		case "fblock": return [
			-1.65,
			0,
			-.5 * out,
			-1.75,
			0
		];
		case "flowblock": return [
			-1,
			0,
			-.42 * out,
			-1.5,
			0
		];
		case "fhit": return [
			.25,
			0,
			.75 * out,
			-.55,
			0
		];
		case "fhitlow": return [
			-.75,
			0,
			-.45 * out,
			-1.5,
			0
		];
		case "fair":
		case "fthrown": return [
			-2.4 + Math.sin(since * 12 + out) * .4,
			0,
			.9 * out,
			-.4,
			0
		];
		case "fdown":
		case "fko": return [
			-.2,
			0,
			1.25 * out,
			-.25,
			0
		];
		case "fgetup": return mix([
			-.4,
			0,
			.6 * out,
			-.4,
			0
		], guard(out), ease$1(clamp01$1(since / .4)));
		case "fgrab": {
			const e = ease$1(clamp01$1(since / .08));
			const swing = clamp01$1((since - .12) / .25);
			return mix(mix(guard(out), [
				-1.45,
				0,
				-.3 * out,
				-.45,
				0
			], e), [
				-2.3,
				0,
				(lead ? .6 : -.6) * out,
				-.6,
				0
			], swing);
		}
		case "fsuper": {
			const n = Math.floor(since / .09);
			const k = since % .09 / .09;
			return n % 2 === 0 === lead ? mix(guard(out), [
				-1.6,
				0,
				-.15 * out,
				-.05,
				0
			], Math.sin(k * Math.PI)) : guard(out);
		}
		default: return null;
	}
}
function fightBody(pose, t, since) {
	const bob = Math.sin(t * 7) * .012;
	switch (pose) {
		case "fstance":
		case "fwalk":
		case "fback":
		case "fdash": return {
			y: -.06 + bob,
			rx: pose === "fdash" ? .25 : .1,
			ry: -.3,
			head: .12
		};
		case "fblock": return {
			y: -.09,
			rx: .12,
			ry: -.2,
			head: .3
		};
		case "jab": return {
			y: -.06,
			z: .06 * reach(since, .06, .12, .25),
			rx: .14,
			ry: -.42,
			head: .1
		};
		case "cross": {
			const e = reach(since, .08, .15, .33);
			return {
				y: -.07,
				z: .14 * e,
				rx: .16,
				ry: -.3 + .75 * e,
				head: .1
			};
		}
		case "uppercut": {
			const k = clamp01$1(since / .11);
			return since < .11 ? {
				y: -.16 * k,
				rx: .3 * k,
				ry: -.1 + .3 * k,
				head: .15
			} : {
				y: -.16 + .22 * reach(since - .11, .07, .15, .4),
				rx: .3 - .4 * reach(since - .11, .07, .15, .4),
				ry: .4,
				head: -.15
			};
		}
		case "highkick": {
			const e = reach(since, .15, .24, .5);
			return {
				y: -.02,
				rx: -.2 * e,
				rz: .4 * e,
				ry: .5 * e,
				head: -.1
			};
		}
		case "fcrouch":
		case "flowblock": return {
			y: -.48,
			rx: .3,
			ry: -.25,
			head: 0
		};
		case "lowpunch": return {
			y: -.48,
			z: .05 * reach(since, .06, .12, .26),
			rx: .35,
			ry: -.35,
			head: 0
		};
		case "sweep": return {
			y: -.62,
			rx: .2,
			ry: -.3 + .9 * reach(since, .13, .23, .5),
			head: 0
		};
		case "fjump":
		case "airpunch":
		case "airkick": return {
			y: .1,
			rx: pose === "airkick" ? -.35 : .15,
			ry: -.2,
			head: .1
		};
		case "fhit": return {
			y: -.04,
			z: -.05,
			rx: -.38,
			ry: 0,
			head: -.45
		};
		case "fhitlow": return {
			y: -.1,
			rx: .55,
			ry: 0,
			head: .45
		};
		case "fair":
		case "fthrown": return {
			y: .25,
			rx: pose === "fthrown" ? -Math.min(Math.PI * 1.6, since * 9) : -Math.min(1.45, .4 + since * 3),
			ry: 0,
			head: -.3
		};
		case "fdown":
		case "fko": return {
			y: .13,
			rx: -1.52,
			ry: 0,
			head: pose === "fko" ? .15 : -.1
		};
		case "fgetup": {
			const k = ease$1(clamp01$1(since / .4));
			return {
				y: .13 * (1 - k) - .06 * k - Math.sin(k * Math.PI) * .25,
				rx: -1.52 * (1 - k) + .1 * k,
				ry: -.3 * k,
				head: .1
			};
		}
		case "fgrab": return {
			y: -.06,
			z: .12,
			rx: .15,
			ry: since > .12 ? -1.2 * ease$1(clamp01$1((since - .12) / .25)) : 0,
			head: .05
		};
		case "fsuper": return {
			y: -.1,
			z: .1,
			rx: .32,
			ry: Math.sin(since * 35) * .35,
			head: .05
		};
		default: return null;
	}
}
//#endregion
//#region ../../../../../../../home/user/babi-life/web/src/avatar/Human.tsx
/** Poses done sitting on a chair (hips at seat height): 'call' is the phone at the ear, sitting. */
var SEATED = [
	"sit",
	"eat",
	"drink",
	"write",
	"call",
	"toilet"
];
var FIDGETS = [
	{
		kind: "scratch",
		len: 2.4
	},
	{
		kind: "watch",
		len: 2.2
	},
	{
		kind: "cross",
		len: 5
	},
	{
		kind: "hips",
		len: 4.5
	},
	{
		kind: "wipe",
		len: 2
	},
	{
		kind: "stretch",
		len: 3
	},
	{
		kind: "phone",
		len: 4.5
	},
	{
		kind: "look",
		len: 2.6
	},
	{
		kind: "neck",
		len: 2.2
	},
	{
		kind: "tap",
		len: 3.5
	},
	{
		kind: "behind",
		len: 6
	},
	{
		kind: "belt",
		len: 1.6
	},
	{
		kind: "chin",
		len: 4
	}
];
/** A number in [0, 1) drawn from a seed and a salt, the same everywhere. */
var draw = (seed, salt) => {
	const n = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
	return n - Math.floor(n);
};
function mannerOf(seed) {
	const r = (k) => draw(seed, k);
	const st = r(7);
	return {
		stride: .88 + r(1) * .24,
		arms: .6 + r(2) * .75,
		lean: -.02 + r(3) * .08,
		bounce: .6 + r(4) * .9,
		sway: .5 + r(5) * 1.2,
		pace: .93 + r(6) * .14,
		stance: st < .55 ? "loose" : st < .72 ? "behind" : st < .88 ? "pockets" : "folded",
		talk: .45 + r(8) * .8
	};
}
var SPEAK = [
	"explain",
	"point",
	"count",
	"shrug",
	"chop",
	"explain",
	"laugh"
];
var LISTEN = [
	"listen",
	"nod",
	"nod"
];
/** What a person in a conversation is doing at time t: two people (seeds apart) take turns. */
function talkAt(t, seed) {
	const u = t / (2.6 + draw(seed, 11) * 1.6) + seed * .37;
	const slot = Math.floor(u);
	const k = u - slot;
	const list = draw(slot, seed * .01 + 3) < .55 ? SPEAK : LISTEN;
	const move = list[Math.floor(draw(slot, seed + 5) * list.length)];
	const e = Math.min(1, k / .2, (1 - k) / .2);
	return {
		move,
		e: e * e * (3 - 2 * e),
		k
	};
}
/** Walking along: now and then a look at the phone, a glance aside. */
function walkingAt(t, seed) {
	const r = draw(Math.floor((t + seed * 5.3) / 9), seed + 21);
	return r < .12 ? "phone" : r < .32 ? "aside" : null;
}
var FIDGET_EVERY = 8;
/**
* The gesture a Sim standing about is making at time t (null most of the
* time), and how far into it (e: 0 → 1 → 0, eased). Each Sim has its own
* rhythm (seed); every screen sees the same, from the shared clock.
*/
function fidgetAt(t, seed) {
	const u = t + seed * 13.7;
	const slot = Math.floor(u / FIDGET_EVERY);
	const n = Math.sin(slot * 91.17 + seed * 47.3) * 43758.5453;
	const r = n - Math.floor(n);
	if (r < .45) return null;
	const f = FIDGETS[Math.floor((r - .45) / .55 * FIDGETS.length) % FIDGETS.length];
	const at = u - slot * FIDGET_EVERY - .8;
	if (at < 0 || at > f.len) return null;
	const k = Math.min(1, at / .45, (f.len - at) / .5);
	return {
		kind: f.kind,
		e: k * k * (3 - 2 * k)
	};
}
/**
* Where the prayer is (from the shared clock, not the Sim's: the rows move
* as one): 0 standing, arms folded; 1 bowing; 2 standing again; 3
* prostrated; 4 sitting back on the heels. A rak'a every 30 s.
*/
function salatStep() {
	const u = worldTime() % 30 / 30;
	const bounds = [
		.36,
		.5,
		.6,
		.8,
		1
	];
	const i = bounds.findIndex((b) => u < b);
	const start = i ? bounds[i - 1] : 0;
	return {
		step: i,
		k: (u - start) / (bounds[i] - start)
	};
}
var clamp01 = (x) => Math.max(0, Math.min(1, x));
var ease = (x) => x * x * (3 - 2 * x);
/** Legs for the match's moves: hip x, hip z, knee x; `since`: seconds into the move. */
function sportLegs(pose, out, t, since) {
	switch (pose) {
		case "swim": return [
			Math.sin(t * 9 + (out > 0 ? 0 : Math.PI)) * .32,
			0,
			.18 + Math.max(0, Math.sin(t * 9 + (out > 0 ? .6 : Math.PI + .6))) * .3
		];
		case "kick": {
			if (out < 0) return [
				-.1,
				0,
				.32
			];
			const p = clamp01(since / .45);
			if (p < .35) return [
				.6 * ease(p / .35),
				0,
				1.35 * ease(p / .35)
			];
			if (p < .6) {
				const q = ease((p - .35) / .25);
				return [
					.6 - 1.95 * q,
					0,
					1.35 * (1 - q) + .1 * q
				];
			}
			return [
				-1.35 + .45 * ease((p - .6) / .4),
				0,
				.12
			];
		}
		case "shoot": {
			const p = clamp01(since / .7);
			return p < .3 ? [
				-.45 * ease(p / .3),
				0,
				.8 * ease(p / .3)
			] : [
				-.1,
				0,
				p < .85 ? .12 : .3
			];
		}
		case "pass": return out > 0 ? [
			-.38 * ease(clamp01(since / .3)),
			0,
			.2
		] : [
			.12,
			0,
			.25
		];
		case "dj": {
			const b = Math.max(0, Math.sin(t * 2.1 * Math.PI * 2));
			const w = Math.sin(t * 2.1 * Math.PI * .5) * out;
			return [
				-.1 - b * .08,
				out * .06,
				.16 + b * .2 + Math.max(0, w) * .12
			];
		}
		case "mark":
		case "guard": return [
			-.42,
			out * .16 + Math.sin(t * 6) * .05,
			.7
		];
		case "dive": return [
			-.18,
			out * .08,
			.25
		];
		case "bounce": return [
			-.22 - Math.max(0, Math.sin(t * 10)) * .06,
			out * .07,
			.4 + Math.max(0, Math.sin(t * 10)) * .12
		];
		case "despair": return [
			.04,
			out * .05,
			out > 0 ? .22 : .06
		];
		case "dunk":
			if (since < .25) return [
				-.5 * ease(since / .25),
				0,
				.95 * ease(since / .25)
			];
			if (since < .55) return out > 0 ? [
				-1.15,
				.05,
				1.45
			] : [
				.25,
				-.05,
				.55
			];
			if (since < 1.15) return [
				-.25 + Math.sin(since * 7 + out) * .15,
				out * .06,
				.55 + Math.sin(since * 7) * .1
			];
			if (since < 1.45) return [
				-.45,
				out * .1,
				.9
			];
			return [
				-.15,
				out * .05,
				.3
			];
		case "layup":
			if (since < .2) return [
				out > 0 ? -.45 : .3,
				0,
				.5
			];
			if (since < .75) return out > 0 ? [
				-1.05,
				0,
				1.3
			] : [
				.15,
				0,
				.35
			];
			return [
				-.3,
				0,
				.6
			];
		case "crossover": {
			const k = Math.sin(clamp01(since / .45) * Math.PI);
			return [
				-.5 - (out > 0 ? k * .35 : 0),
				out * (.22 + k * .18),
				.85 + k * .2
			];
		}
		case "block": return since < .15 ? [
			-.5,
			0,
			1
		] : since < .65 ? [
			-.1,
			out * .05,
			.25
		] : [
			-.4,
			0,
			.75
		];
		case "steal": return out > 0 ? [
			-.85,
			.05,
			.95
		] : [
			.35,
			-.05,
			.25
		];
		case "slide": return out > 0 ? [
			-.75,
			.05,
			.05
		] : [
			-.2,
			-.1,
			1.5
		];
		case "stumble": {
			const k = clamp01(since / .3);
			return [
				out * .3 * k - .2,
				-out * .2 * k,
				.5
			];
		}
		case "bouncepass": return out > 0 ? [
			-.5,
			0,
			.6
		] : [
			.2,
			0,
			.35
		];
		case "stepover": {
			if (since > .42) return out > 0 ? [
				-.5,
				0,
				.6
			] : [
				.3,
				0,
				.4
			];
			const lead = since < .21 ? 1 : -1;
			const k = clamp01((since - (lead > 0 ? 0 : .21)) / .21);
			if (out === lead) {
				const s = Math.sin(k * Math.PI);
				return [
					-.25 - .45 * s,
					out * (-.3 + .8 * k),
					.35 + .55 * s
				];
			}
			return [
				-.05,
				out * .14,
				.42
			];
		}
		case "roulette":
			if (since > .6) return out > 0 ? [
				-.55,
				0,
				.7
			] : [
				.3,
				0,
				.35
			];
			return out === (since < .3 ? 1 : -1) ? [
				-.5,
				out * .1,
				.25
			] : [
				.1,
				out * .12,
				.45
			];
		case "poke":
			if (since < .16) {
				const k = ease(since / .16);
				return out > 0 ? [
					-.1 - .75 * k,
					0,
					.9 - .8 * k
				] : [
					.05,
					0,
					.35
				];
			}
			return out > 0 ? [
				-.3,
				0,
				.5
			] : [
				.25,
				0,
				.6
			];
		case "rainbow":
			if (since < .18) return out > 0 ? [
				.05,
				out * .05,
				.45
			] : [
				-.35 + .5 * ease(since / .18),
				0,
				.35
			];
			if (since < .36) {
				const k = Math.sin((since - .18) / .18 * Math.PI);
				return out > 0 ? [
					.1 + .45 * k,
					0,
					.6 + 1.5 * k
				] : [
					.1,
					0,
					.3
				];
			}
			return out > 0 ? [
				-.45,
				0,
				.6
			] : [
				.25,
				0,
				.45
			];
		case "feint":
			if (since < .22) {
				const k = ease(since / .22);
				return out > 0 ? [
					.6 * k,
					0,
					1.35 * k
				] : [
					-.1,
					0,
					.32
				];
			}
			if (since < .32) return out > 0 ? [
				-.3,
				out * .15,
				.5
			] : [
				-.05,
				0,
				.4
			];
			return out > 0 ? [
				-.4,
				out * .35,
				.6
			] : [
				.2,
				out * .2,
				.4
			];
		case "flick":
			if (out < 0) return [
				-.1,
				out * .1,
				.35
			];
			if (since < .14) {
				const k = ease(since / .14);
				return [
					.35 * k,
					-.45 * k,
					.4 + .6 * k
				];
			}
			if (since < .3) {
				const k = ease((since - .14) / .16);
				return [
					.35 - .15 * k,
					-.45 + .85 * k,
					1 - .6 * k
				];
			}
			return [
				0,
				.1,
				.3
			];
		case "backheel": {
			if (out < 0) return [
				-.15,
				out * .08,
				.4
			];
			if (since < .08) return [
				-.35 * ease(since / .08),
				0,
				.45
			];
			if (since < .24) {
				const k = ease((since - .08) / .16);
				return [
					-.35 + 1 * k,
					0,
					.45 + .4 * k
				];
			}
			const k = ease(clamp01((since - .24) / .2));
			return [
				.65 - .6 * k,
				0,
				.85 - .5 * k
			];
		}
		case "juggle": {
			const n = Math.round(since / .48);
			if (out !== (n % 2 === 0 ? 1 : -1)) return [
				-.05,
				out * .1,
				.3
			];
			const bump = Math.exp(-(((since - n * .48) / .11) ** 2));
			return [
				-.15 - .75 * bump,
				out * .05,
				.35 + .35 * bump
			];
		}
		case "nutmegged": return since < .4 ? [
			-.1,
			out * .42,
			.4
		] : [
			out * .25 - .1,
			out * .2,
			.5
		];
		case "lookup": return [
			out > 0 ? .25 : -.1,
			out * .1,
			.4
		];
		case "flinch": return out > 0 ? [
			-.6,
			out * .5,
			.25
		] : [
			.05,
			out * .08,
			.55
		];
		case "between":
			if (since > .45) return out > 0 ? [
				-.5,
				0,
				.6
			] : [
				.3,
				0,
				.4
			];
			return out > 0 ? [
				-.8 * ease(clamp01(since / .15)),
				out * .2,
				1
			] : [
				.4,
				out * .22,
				.45
			];
		case "backdribble": return out > 0 ? [
			-.55,
			out * .12,
			.7
		] : [
			.25,
			out * .16,
			.45
		];
		case "spinmove": return out > 0 ? [
			-.35,
			out * .3,
			.7
		] : [
			-.1 + Math.sin(since * 14) * .25,
			out * .2,
			.6
		];
		case "hesi":
			if (since < .42) return [
				-.12,
				out * .1,
				.18
			];
			return out > 0 ? [
				-.85,
				0,
				.95
			] : [
				.4,
				0,
				.35
			];
		case "dribbleshow": return [
			-.45 - Math.max(0, Math.sin(t * 6.2 + out)) * .1,
			out * .24,
			.8 + Math.max(0, Math.sin(t * 6.2 + out)) * .2
		];
		case "pumpfake":
			if (since < .24) {
				const k = ease(since / .24);
				return [
					-.38 * k,
					out * .08,
					.65 * k
				];
			}
			if (since < .42) return [
				-.15,
				out * .08,
				.25
			];
			return out > 0 ? [
				-.8,
				0,
				.9
			] : [
				.35,
				0,
				.35
			];
		case "stepback":
			if (since < .2) return out > 0 ? [
				-.6,
				0,
				.75
			] : [
				.15,
				0,
				.45
			];
			if (since < .4) return [
				.3,
				out * .1,
				.55
			];
			return [
				-.4,
				out * .18,
				.75
			];
		case "ankles":
			if (since < .25) return [
				out * .3 - .2,
				-out * .22,
				.5
			];
			if (since < .55) {
				const k = ease((since - .25) / .3);
				return [
					-.2 - 1.25 * k,
					out * .2,
					.5 - .25 * k
				];
			}
			if (since < 1.35) return [
				-1.45,
				out * .2,
				.25 + (out > 0 ? .15 : 0)
			];
			return [
				-1.9,
				out * .14,
				1.9
			];
		case "turned": return [
			out * .2 - .25,
			-out * .2,
			.5
		];
		case "frozen": return [
			-.05,
			out * .12,
			.08
		];
		case "windmill":
			if (since < .2) return [
				-.55 * ease(since / .2),
				0,
				1 * ease(since / .2)
			];
			if (since < .9) return out > 0 ? [
				-1.25,
				.05,
				1.6
			] : [
				.25,
				-.05,
				1
			];
			if (since < 1.5) return [
				-.25 + Math.sin(since * 7 + out) * .15,
				out * .06,
				.55 + Math.sin(since * 7) * .1
			];
			return [
				-.45,
				out * .1,
				.9
			];
		case "salat": {
			const { step } = salatStep();
			return step === 1 ? [
				-1.35,
				0,
				.05
			] : step === 3 ? [
				-2.1,
				out * .05,
				2.17
			] : step === 4 ? [
				.05,
				out * .05,
				1.55
			] : [
				0,
				out * .04,
				.02
			];
		}
		default: return null;
	}
}
/** Arms for the match's moves: shoulder x, y, z, elbow x, z. */
function sportArms(pose, out, t, since, armSwing) {
	switch (pose) {
		case "swim": {
			const a = t * 2.6 + (out > 0 ? 0 : Math.PI);
			return [
				-1.55 - 1.55 * Math.cos(a),
				0,
				out * .18,
				Math.sin(a) > 0 ? -.9 : -.12,
				0
			];
		}
		case "kick": return [
			out < 0 ? -.8 : .45,
			0,
			out * .75,
			-.35,
			0
		];
		case "shoot": {
			const k = ease(clamp01((clamp01(since / .7) - .25) / .35));
			return [
				-1.05 - 1.85 * k,
				0,
				out * (.28 - .16 * k),
				-1.75 + 1.45 * k,
				0
			];
		}
		case "pass": {
			const k = ease(clamp01(since / .3));
			return [
				-.9 - .55 * k,
				0,
				out * (.28 - .18 * k),
				-1.85 + 1.7 * k,
				0
			];
		}
		case "touch": return [
			armSwing * .55,
			0,
			out * .38,
			-.85,
			0
		];
		case "mark": return [
			-.35 + Math.sin(t * 6 + out) * .08,
			0,
			out * .55,
			-.55,
			0
		];
		case "guard": return [
			-.95 + Math.sin(t * 4 + out * 1.3) * .25,
			0,
			out * 1.2,
			-.3,
			0
		];
		case "dive": return [
			-.25,
			0,
			out * (2.7 - .4 * (1 - clamp01(since / .3))),
			-.12,
			0
		];
		case "bounce": return out > 0 ? [
			-.75 + Math.sin(t * 10) * .35,
			0,
			.3,
			-.75 + Math.sin(t * 10) * .3,
			0
		] : [
			-.45,
			0,
			-.32,
			-.9,
			0
		];
		case "despair": return [
			-2.55,
			0,
			out * .85,
			-2,
			0
		];
		case "airplane": return [
			.05,
			0,
			out * 1.45,
			-.05,
			0
		];
		case "dunk":
			if (since < .25) return [
				-1,
				0,
				out * .28,
				-1.7,
				0
			];
			if (since < .55) {
				const k = ease((since - .25) / .3);
				return [
					-1 - 2 * k,
					0,
					out * (.28 - .12 * k),
					-1.7 + 1.55 * k,
					0
				];
			}
			if (since < 1.15) return [
				-3 + Math.sin(since * 7) * .04,
				0,
				out * .2,
				-.05,
				0
			];
			if (since < 1.45) return [
				-1.4,
				0,
				out * .5,
				-.4,
				0
			];
			return [
				-.2,
				0,
				out * .25,
				-.3,
				0
			];
		case "layup":
			if (since < .2) return [
				-1,
				0,
				out * .28,
				-1.6,
				0
			];
			return out > 0 ? [
				-2.75,
				0,
				.18,
				-.15,
				0
			] : [
				-1,
				0,
				-.35,
				-1.1,
				0
			];
		case "crossover": {
			const k = clamp01(since / .45);
			return (k < .5 ? out > 0 : out < 0) ? [
				-.75,
				0,
				out * (.05 - Math.sin(k * Math.PI) * .45),
				-.55,
				0
			] : [
				-.45,
				0,
				out * .55,
				-.6,
				0
			];
		}
		case "block": return [
			-2.95 + (since < .15 ? 1.2 : 0),
			0,
			out * .12,
			-.05,
			0
		];
		case "steal": return out > 0 ? [
			-1.25,
			0,
			.05,
			-.1,
			0
		] : [
			.35,
			0,
			-.6,
			-.4,
			0
		];
		case "slide": return [
			.75,
			0,
			out * .45,
			-.15,
			0
		];
		case "stumble": {
			const w = Math.sin(t * 9 + out) * .3;
			return [
				-.4 + w,
				0,
				out * (1.25 + w),
				-.4,
				0
			];
		}
		case "bouncepass": {
			const k = ease(clamp01(since / .3));
			return [
				-1 + .35 * k,
				0,
				out * (.3 - .15 * k),
				-1.8 + 1.7 * k,
				0
			];
		}
		case "stepover":
		case "roulette":
		case "rainbow":
		case "flick":
		case "backheel": return [
			-.25 + Math.sin(t * 7 + out) * .08,
			0,
			out * (pose === "roulette" ? 1 : .8),
			-.5,
			0
		];
		case "poke": return [
			out < 0 ? -.6 : .4,
			0,
			out * .5,
			-.7,
			0
		];
		case "feint": return since < .32 ? [
			out < 0 ? -.8 : .45,
			0,
			out * .75,
			-.35,
			0
		] : [
			-.3,
			0,
			out * .9,
			-.45,
			0
		];
		case "juggle": return [
			-.25 + Math.sin(t * 6.5 + out) * .1,
			0,
			out * .65,
			-.6,
			0
		];
		case "nutmegged": return [
			.05,
			0,
			out * .5,
			-.3,
			0
		];
		case "lookup": return [
			-1.2,
			0,
			out * .4,
			-.5,
			0
		];
		case "flinch": return [
			-.7,
			0,
			out * .25,
			-1.9,
			0
		];
		case "between": {
			const k = clamp01(since / .45);
			return (k < .5 ? out > 0 : out < 0) ? [
				-.45,
				0,
				out * (.15 + Math.sin(k * Math.PI) * .2),
				-.35,
				0
			] : [
				-.55,
				0,
				out * .45,
				-.5,
				0
			];
		}
		case "backdribble": {
			const k = clamp01(since / .45);
			return (k < .5 ? out > 0 : out < 0) ? [
				.6,
				0,
				out * .3,
				-.75,
				0
			] : [
				-.35 + k * .6,
				0,
				out * .4,
				-.6,
				0
			];
		}
		case "spinmove": return out > 0 ? [
			-.6,
			0,
			.3,
			-1.35,
			0
		] : [
			-.25,
			0,
			out * 1,
			-.35,
			0
		];
		case "hesi":
			if (since < .42) return out > 0 ? [
				-.7 + Math.sin(since * 10) * .15,
				0,
				.35,
				-.55,
				0
			] : [
				-1,
				0,
				-.25,
				-1.3,
				0
			];
			return [
				armSwing * 1.1,
				0,
				out * .15,
				-1.4,
				0
			];
		case "dribbleshow": {
			const w = Math.sin(t * 6.2 + (out > 0 ? 0 : Math.PI));
			return [
				-.55 + w * .25,
				0,
				out * (.4 + Math.max(0, w) * .2),
				-.5,
				0
			];
		}
		case "pumpfake": {
			const k = since < .24 ? ease(since / .24) : Math.max(0, 1 - (since - .24) / .18);
			if (since < .42) return [
				-1.05 - 1.6 * k,
				0,
				out * (.28 - .12 * k),
				-1.75 + 1.25 * k,
				0
			];
			return [
				armSwing * 1.1,
				0,
				out * .15,
				-1.4,
				0
			];
		}
		case "stepback": return out > 0 ? [
			-.55,
			0,
			.35,
			-.5,
			0
		] : [
			-.9,
			0,
			-.25,
			-.45,
			0
		];
		case "ankles":
			if (since < .45) {
				const w = Math.sin(t * 9 + out) * .3;
				return [
					-.4 + w,
					0,
					out * (1.25 + w),
					-.4,
					0
				];
			}
			return [
				.65,
				0,
				out * .35,
				-.1,
				0
			];
		case "turned": return [
			-.3 + Math.sin(t * 8 + out) * .2,
			0,
			out * 1.1,
			-.35,
			0
		];
		case "frozen": return [
			-.85,
			0,
			out * .55,
			-.6,
			0
		];
		case "windmill":
			if (since < .2) return [
				-1,
				0,
				out * .28,
				-1.7,
				0
			];
			if (out < 0 && since < .95) return [
				-.5,
				0,
				out * 1.2,
				-.3,
				0
			];
			if (since < .55) {
				const k = ease((since - .2) / .35);
				return [
					-1 + 1.9 * k,
					0,
					out * .4,
					-1.7 + 1.55 * k,
					0
				];
			}
			if (since < .85) {
				const k = ease((since - .55) / .3);
				return [
					.9 - 1.2 * k,
					0,
					out * (.4 + 2.5 * k),
					-.15,
					0
				];
			}
			if (since < 1.5) return [
				-3 + Math.sin(since * 7) * .04,
				0,
				out * .2,
				-.05,
				0
			];
			return [
				-1.4,
				0,
				out * .5,
				-.4,
				0
			];
		case "dj": {
			const bar = t * 2.1 / 8;
			const k = bar - Math.floor(bar);
			if (out > 0) {
				if (k > .8) return [
					-.25,
					0,
					2.5 + Math.max(0, Math.sin(t * 2.1 * Math.PI * 2)) * .25,
					-.3,
					.2
				];
				const sc = Math.sin(t * 9) * (Math.sin(t * 1.3) > -.3 ? 1 : .25);
				return [
					-.95 + sc * .1,
					0,
					.14,
					-.8 + sc * .2,
					0
				];
			}
			return Math.floor(bar * 2) % 2 === 0 ? [
				-1.35,
				0,
				-.38,
				-2.35,
				0
			] : [
				-.85,
				0,
				-.1,
				-.95 + Math.sin(t * 5) * .08,
				0
			];
		}
		case "film": return out > 0 ? [
			-1.55 + Math.sin(t * 1.3) * .05,
			0,
			.12,
			-.75,
			0
		] : [
			-1.35,
			0,
			-.35,
			-1.05,
			0
		];
		case "salat": {
			const { step } = salatStep();
			return step === 0 ? [
				-.5,
				0,
				-out * .42,
				-1.75,
				0
			] : step === 1 ? [
				-1.1,
				0,
				out * .1,
				-.1,
				0
			] : step === 3 ? [
				-2.2,
				0,
				out * .3,
				-.3,
				0
			] : step === 4 ? [
				-.45,
				0,
				out * .08,
				-.9,
				0
			] : [
				0,
				0,
				out * .06,
				-.05,
				0
			];
		}
		default: return null;
	}
}
/** The body as a whole: height, lean forward (rx) and sideways (rz), the head's nod; null where the pose doesn't change it. */
function sportBody(pose, t, since) {
	switch (pose) {
		case "kick": return {
			rx: since < .3 ? .08 : -.12,
			head: .3
		};
		case "shoot": {
			const p = clamp01(since / .7);
			return {
				y: p < .3 ? -.11 * ease(p / .3) : p < .85 ? Math.sin((p - .3) / .55 * Math.PI) * .32 : 0,
				head: -.25
			};
		}
		case "pass": return {
			rx: .12,
			head: 0
		};
		case "touch": return {
			rx: .18,
			head: .3
		};
		case "mark":
		case "guard": return {
			y: -.1,
			x: Math.sin(t * 3) * .12,
			rx: .15,
			head: .05
		};
		case "dive": {
			const k = ease(clamp01(since / .35));
			return {
				y: .2 * k + Math.sin(k * Math.PI) * .32,
				rz: -1.4 * k,
				head: 0
			};
		}
		case "airplane": return {
			rz: Math.sin(t * 2.6) * .3,
			rx: .05,
			head: -.15
		};
		case "bounce": return {
			y: -.05 - Math.max(0, Math.sin(t * 10)) * .025,
			rx: .12,
			head: .25
		};
		case "despair": return {
			y: -.02,
			rx: -.12,
			ry: Math.sin(t * 2.2) * .12,
			head: -.3
		};
		case "dunk":
			if (since < .25) return {
				y: -.13 * ease(since / .25),
				rx: .15,
				head: -.1
			};
			if (since < .55) return {
				y: -.13 + 1.25 * ease((since - .25) / .3),
				rx: 0,
				head: -.35
			};
			if (since < 1.15) return {
				y: 1.12 + Math.sin(since * 7) * .025,
				rx: -.1 + Math.sin(since * 7) * .06,
				head: -.2
			};
			if (since < 1.45) return {
				y: 1.12 * (1 - ease((since - 1.15) / .3)) - .1 * ease((since - 1.15) / .3),
				rx: .1,
				head: 0
			};
			return {
				y: -.1 * (1 - clamp01((since - 1.45) / .3)),
				rx: 0,
				head: 0
			};
		case "layup": {
			const p = clamp01((since - .2) / .55);
			return {
				y: since < .2 ? -.06 : Math.sin(p * Math.PI) * .55,
				rx: .05,
				head: -.3
			};
		}
		case "crossover": {
			const k = clamp01(since / .45);
			return {
				y: -.12,
				x: Math.cos(k * Math.PI) * .16,
				rx: .25,
				rz: -Math.sin(k * Math.PI * 2) * .12,
				head: .1
			};
		}
		case "block": return {
			y: since < .15 ? -.1 : since < .65 ? Math.sin((since - .15) / .5 * Math.PI) * .5 : -.05,
			head: -.35
		};
		case "steal": return {
			y: -.14,
			rx: .4,
			head: .25
		};
		case "slide": {
			const k = ease(clamp01(since / .2));
			return {
				y: -.42 * k,
				rx: -.95 * k,
				head: .45 * k
			};
		}
		case "stumble": {
			const k = ease(clamp01(since / .35));
			return {
				y: -.18 * k,
				rz: .45 * k + Math.sin(t * 7) * .05,
				rx: -.15 * k,
				head: -.1
			};
		}
		case "bouncepass": return {
			y: -.06,
			rx: .25,
			head: .1
		};
		case "stepover": {
			const lead = since < .21 ? 1 : -1;
			const s = since > .42 ? 0 : Math.sin(clamp01((since - (lead > 0 ? 0 : .21)) / .21) * Math.PI);
			return {
				y: -.1,
				x: lead * .12 * s,
				rx: since > .42 ? .3 : .22,
				rz: -lead * .16 * s,
				ry: lead * .35 * s,
				head: .3
			};
		}
		case "roulette": return {
			y: -.08,
			rx: .12,
			head: .25
		};
		case "poke": return {
			y: -.06,
			rx: since < .16 ? .12 : .18,
			head: .3
		};
		case "rainbow": return {
			y: since > .18 && since < .36 ? .06 : -.05,
			rx: since < .36 ? .3 : .1,
			head: since < .3 ? .35 : -.3
		};
		case "feint": return since < .32 ? {
			rx: since < .22 ? .08 : -.1,
			head: .3
		} : {
			y: -.08,
			rx: .2,
			rz: .22,
			ry: .35,
			head: .25
		};
		case "flick": return {
			y: -.06,
			rx: .12,
			rz: -.1,
			ry: .3,
			head: .25
		};
		case "backheel": return {
			y: -.06,
			rx: .25,
			head: .15
		};
		case "juggle": return {
			y: -.03,
			rx: .08,
			head: .3 + Math.sin(t * 13) * .05
		};
		case "nutmegged": return since < .4 ? {
			y: -.08,
			rx: .15,
			head: .55
		} : {
			y: -.1,
			rx: .05,
			rz: .15,
			head: .1
		};
		case "lookup": return {
			y: -.02,
			rx: -.25,
			head: -.7
		};
		case "flinch": {
			const k = ease(clamp01((since - .45) / .3));
			return {
				y: -.12 - .08 * k,
				rz: .25 + .2 * k,
				ry: .7,
				rx: .15,
				head: .4
			};
		}
		case "between": return {
			y: -.2,
			rx: .35,
			head: .15
		};
		case "backdribble": {
			const k = clamp01(since / .45);
			return {
				y: -.12,
				rx: .25,
				ry: -Math.sin(k * Math.PI) * .35,
				head: .1
			};
		}
		case "spinmove": return {
			y: -.15,
			rx: .2,
			rz: .12,
			head: .05
		};
		case "hesi": return since < .42 ? {
			y: .02,
			rx: -.06,
			head: -.25
		} : {
			y: -.15,
			rx: .45,
			head: .1
		};
		case "dribbleshow": return {
			y: -.18 - Math.max(0, Math.sin(t * 6.2)) * .04,
			x: Math.sin(t * 6.2) * .08,
			rx: .3,
			rz: Math.sin(t * 3.1) * .08,
			head: .15 + Math.sin(t * 12.4) * .05
		};
		case "pumpfake": return since < .24 ? {
			y: -.1 * ease(since / .24),
			rx: .05,
			head: -.3
		} : since < .42 ? {
			y: .02,
			rx: -.04,
			head: -.3
		} : {
			y: -.15,
			rx: .45,
			head: .1
		};
		case "stepback": return since < .2 ? {
			y: -.15,
			rx: .3,
			head: .1
		} : since < .4 ? {
			y: .1,
			rx: -.12,
			head: -.1
		} : {
			y: -.14,
			rx: .15,
			head: -.15
		};
		case "ankles": {
			if (since < .25) return {
				y: -.1 * ease(since / .25),
				rz: .3 * ease(since / .25),
				rx: -.1,
				head: -.1
			};
			if (since < .55) {
				const k = ease((since - .25) / .3);
				return {
					y: -.1 - .58 * k,
					rz: .3 * (1 - k),
					rx: -.1 - .25 * k,
					head: -.1
				};
			}
			if (since < 1.35) return {
				y: -.68,
				rx: -.35,
				ry: Math.sin(since * 9) * .12,
				head: .2
			};
			const k = ease(clamp01((since - 1.35) / .25));
			return {
				y: -.68 * (1 - k) - .05,
				rx: -.35 + .5 * k,
				head: .1
			};
		}
		case "turned": return {
			y: -.08,
			rz: .15,
			ry: .6,
			head: 0
		};
		case "frozen": return {
			y: .01,
			x: Math.sin(t * 31) * .006,
			rx: -.12,
			head: -.1
		};
		case "windmill":
			if (since < .2) return {
				y: -.13 * ease(since / .2),
				rx: .15,
				head: -.1
			};
			if (since < .75) return {
				y: -.13 + 1.25 * ease((since - .2) / .55),
				rx: .15,
				head: -.35
			};
			if (since < 1.5) return {
				y: 1.12 + Math.sin(since * 7) * .025,
				rx: -.1 + Math.sin(since * 7) * .06,
				head: -.2
			};
			if (since < 1.8) return {
				y: 1.12 * (1 - ease((since - 1.5) / .3)) - .1 * ease((since - 1.5) / .3),
				rx: .1,
				head: 0
			};
			return {
				y: -.1,
				rx: 0,
				head: 0
			};
		case "film": return { head: -.06 };
		case "dj": {
			const b = Math.max(0, Math.sin(t * 2.1 * Math.PI * 2));
			return {
				y: -.02 - b * .04,
				rx: .1 + b * .03,
				head: .18 + b * .2
			};
		}
		case "salat": {
			const { step } = salatStep();
			const lean = (rx, hip) => ({
				y: hip - .84 * Math.cos(rx),
				z: -.84 * Math.sin(rx),
				rx
			});
			return step === 1 ? {
				...lean(1.35, .84),
				head: -.2,
				x: 0
			} : step === 3 ? {
				...lean(1.5, .4),
				head: -.3,
				x: 0
			} : step === 4 ? {
				y: -.4,
				z: 0,
				rx: 0,
				head: .25,
				x: 0
			} : {
				y: 0,
				z: 0,
				rx: 0,
				head: .2,
				x: 0
			};
		}
		default: return null;
	}
}
/** Quick moves: the joints follow closely, or the jump would be over before the body got there. */
var SNAPPY = /* @__PURE__ */ new Set([
	"dunk",
	"layup",
	"crossover",
	"block",
	"steal",
	"slide",
	"stumble",
	"bouncepass",
	"stepover",
	"roulette",
	"poke",
	"rainbow",
	"feint",
	"flick",
	"backheel",
	"juggle",
	"nutmegged",
	"lookup",
	"flinch",
	"between",
	"backdribble",
	"spinmove",
	"hesi",
	"dribbleshow",
	"pumpfake",
	"stepback",
	"ankles",
	"turned",
	"frozen",
	"windmill"
]);
/**
* Moves a rig for a pose, every frame: index 0 of each pair is the side at -x.
* Rotations are about the rest pose's axes (the person faces +z): x swings a
* limb forward (negative) or back, z raises it sideways.
*/
/**
* take: a count; when it changes, the pose starts over (a second jab after the first).
* clock: the seconds into the pose, when something else keeps time (the fight's hit-stop and slow motion).
*/
function usePoseRig({ root, head, chest, hip, knee, shoulder, elbow }, pose, seed, speed, style = {}, take = 0, clock) {
	const { snap = 1, swing: swingK = 1, elbow: elbowK = 1, knee: kneeK = 1, headBob = 0 } = style;
	const m = mannerOf(seed);
	const phase = useRef(null);
	const glance = useRef({
		y: 0,
		x: 0,
		next: 0
	});
	const began = useRef({
		pose,
		take,
		t: 0
	});
	useFrame((_, dtRaw) => {
		const dt = Math.min(Math.max(dtRaw, 0), .1);
		const t = worldTime() + seed;
		if (began.current.pose !== pose || began.current.take !== take) began.current = {
			pose,
			take,
			t: worldTime() + seed
		};
		const since = clock ? clock() : worldTime() + seed - began.current.t;
		const run = pose === "run" || pose === "touch" || pose === "airplane";
		const walk = pose === "walk" || run || pose === "dribble" || pose === "push";
		const seated = SEATED.includes(pose);
		const v = speed ?? (run ? 8 : 1.4);
		const cadence = (run ? 1.5 + v * .07 : Math.min(2.1, .85 + v * .3)) * m.pace / Math.sqrt(m.stride);
		phase.current = (phase.current ?? t * Math.PI * 2 * cadence) + dt * Math.PI * 2 * cadence;
		const ph = phase.current;
		const s = Math.sin(ph);
		const stride = (run ? pose === "touch" ? .7 : .95 : Math.min(.62, .3 + v * .09)) * swingK * m.stride;
		const rhythmic = walk || SNAPPY.has(pose) || EMOTE_SNAPPY.has(pose) && since > .25 || pose === "dance" || pose === "dj" || pose === "throw" || pose === "cheer" || pose === "leap" || pose === "hang" || pose === "wash" || pose === "cook";
		const fight = isFight(pose);
		const a = 1 - Math.exp(-(fight ? 48 : rhythmic ? 30 : 13) * snap * dt);
		const to = (o, k, target) => void (o[k] += (target - o[k]) * a);
		const shift = Math.sin(t * .35 + seed);
		const fid = pose === "idle" ? fidgetAt(t, seed) : null;
		const tk = pose === "talk" ? talkAt(t, seed) : null;
		const wf = pose === "walk" ? walkingAt(t, seed) : null;
		const beat = t * 2.1 * Math.PI * 2;
		const bounce = Math.max(0, Math.sin(beat));
		const jump = Math.sin(t * 5);
		for (const i of [0, 1]) {
			const out = i === 0 ? -1 : 1;
			const h = hip[i].current;
			const kn = knee[i].current;
			const u = ((ph / (Math.PI * 2) + (out > 0 ? 0 : .5)) % 1 + 1) % 1;
			const near = (c, w) => {
				const d = Math.min(Math.abs(u - c), 1 - Math.abs(u - c));
				return Math.exp(-((d / w) ** 2));
			};
			const kick = pose === "kick" && out > 0;
			const gaitHip = -stride * Math.cos(u * Math.PI * 2) - stride * .15;
			const gaitKnee = (run ? .45 * near(.15, .1) + 1.9 * near(.72, .17) : .22 * near(.12, .09) + 1 * near(.72, .14)) * kneeK + .04;
			const danceStep = pose === "dance" ? out * Math.max(0, out * Math.sin(beat / 2)) * .14 : 0;
			const dangle = Math.sin(t * 3.1 + seed) * .12;
			const sl = sportLegs(pose, out, t, since) ?? fightLegs(pose, out, t, since) ?? emoteLegs(pose, out, t, since);
			to(h.rotation, "x", sl ? sl[0] : pose === "pray" ? .05 : pose === "sleep" ? 0 : pose === "leap" ? -.95 : pose === "hang" ? out > 0 ? -.35 : .3 + dangle : seated ? -1.5 : kick ? -1.15 : pose === "keeper" ? -.45 : walk ? gaitHip : pose === "dance" || pose === "throw" ? -.18 - bounce * .16 : pose === "cheer" ? -Math.max(0, -jump) * .4 : 0);
			to(h.rotation, "z", sl ? sl[1] : pose === "hang" ? out < 0 ? -.35 : .05 : pose === "leap" ? out * .08 : walk || seated ? 0 : pose === "dance" ? danceStep : out * shift * .03);
			to(kn.rotation, "x", sl ? sl[2] : pose === "pray" ? 1.55 : pose === "sleep" ? .05 : pose === "leap" ? 1.35 : pose === "hang" ? out > 0 ? .55 : .35 - dangle : seated ? 1.5 : kick ? .15 : pose === "keeper" ? .8 : walk ? gaitKnee : pose === "dance" || pose === "throw" ? .32 + bounce * .32 : pose === "cheer" ? Math.max(0, -jump) * .8 : fid?.kind === "tap" && out > 0 ? fid.e * (.2 + Math.max(0, Math.sin(t * 9)) * .25) : tk?.move === "laugh" ? tk.e * .12 : Math.max(0, -out * shift) * .12);
			const armSwing = stride * Math.cos(u * Math.PI * 2) * (run ? 1 : m.arms);
			const sh = shoulder[i].current;
			const el = elbow[i].current;
			let [sx, sy, sz, ex, ez] = [
				0,
				0,
				out * .1,
				-.12,
				0
			];
			const sa = sportArms(pose, out, t, since, armSwing) ?? fightArms(pose, out, t, since) ?? emoteArms(pose, out, t, since) ?? jobArms(pose, out, t);
			if (sa) [sx, sy, sz, ex, ez] = sa;
			else if (pose === "wash") {
				const k = Math.sin(t * 6 + i * 1.3);
				[sx, sz, ex] = out > 0 ? [
					-2.3 + k * .15,
					.5,
					-1.9 + k * .35
				] : [
					-.9 + k * .35,
					-.25,
					-1.4 + k * .25
				];
			} else if (pose === "sleep") [sx, sz, ex] = [
				0,
				out * .06,
				-.08
			];
			else if (pose === "pray") [sx, sz, ex] = [
				-1.05,
				out * -.32,
				-.95
			];
			else if (pose === "cook") [sx, sz, ex] = out > 0 ? [
				-.95 + Math.cos(t * 4) * .15,
				.15 + Math.sin(t * 4) * .15,
				-1.05
			] : [
				-.75,
				-.15,
				-.9
			];
			else if ((pose === "phone" || pose === "call") && out > 0) [sx, sz, ex] = [
				-1.35,
				.35,
				-2.35
			];
			else if (pose === "call") {
				const g = Math.max(0, Math.sin(t * 1.9));
				[sx, sz, ex] = [
					-.5 - g * .45,
					-.12,
					-.7 - g * .5
				];
			} else if (pose === "snack" && out > 0) {
				const k = Math.max(0, Math.sin(t * 1.7));
				[sx, sz, ex] = [
					-.45 - k * .85,
					.16,
					-.95 - k * 1.05
				];
			} else if (pose === "snack") [sx, sz, ex] = [
				-.6,
				-.2,
				-1.05
			];
			else if (pose === "phone") {
				const g = Math.max(0, Math.sin(t * 2.6));
				[sx, sz, ex] = [
					-.3 - g * .5,
					-.14,
					-.5 - g * .6
				];
			} else if (pose === "leap") [sx, sz, ex] = [
				-2.1 + (out > 0 ? -.2 : 0),
				out * .25,
				-.35
			];
			else if (pose === "hang" && out > 0) [sx, sz, ex] = [
				-.35,
				2.45,
				-.25
			];
			else if (pose === "hang") [sx, sz, ex, ez] = [
				-.3 + Math.sin(t * 2.2) * .15,
				-1.55 - Math.max(0, Math.sin(t * 2.2)) * .5,
				-.4,
				Math.sin(t * 8) * .3
			];
			else if (pose === "dance") {
				const sway = Math.sin(beat / 2 + i * Math.PI);
				[sx, sz, ex] = [
					-.55 - bounce * .2 - sway * .25,
					out * (.3 + bounce * .12),
					-1.35 - Math.sin(beat + i) * .2
				];
				sy = sway * .35;
			} else if (pose === "cheer") [sx, sz, ex] = [
				-.25,
				out * (2.55 + Math.max(0, jump) * .25 + Math.sin(t * 13 + i) * .08),
				-.25
			];
			else if (pose === "push") [sx, sz, ex] = [
				-.95,
				out * .08,
				-.35
			];
			else if (pose === "busy") [sx, sz, ex] = [
				-1.1 + Math.sin(t * 6 + i) * .25,
				out * .15,
				-.9 + Math.sin(t * 6 + i) * .2
			];
			else if (pose === "wave" && out > 0) [sx, sz, ex, ez] = [
				0,
				2.6,
				0,
				.35 + Math.sin(t * 9) * .35
			];
			else if ((pose === "eat" || pose === "drink") && out > 0) {
				const k = Math.max(0, Math.sin(t * (pose === "eat" ? 2.4 : 1.2)));
				[sx, sz, ex] = [
					-.6 - k * .75,
					.12,
					-.9 - k * 1.1
				];
			} else if (pose === "write" || (pose === "eat" || pose === "drink") && out < 0) [sx, sz, ex] = [
				-.55,
				out * .1,
				-1 + (pose === "write" && out > 0 ? Math.sin(t * 7) * .08 : 0)
			];
			else if (pose === "throw" && out > 0) {
				const k = t * 2.4 % 1;
				const flick = k < .6 ? 0 : k < .75 ? (k - .6) / .15 : 1 - (k - .75) / .25;
				const f = flick * flick * (3 - 2 * flick);
				[sx, sz, ex] = [
					-1.05 - f * .95,
					-.3 + f * .8,
					-1.55 + f * 1.15
				];
			} else if (pose === "throw") [sx, sz, ex] = [
				-.95,
				.32,
				-1.55
			];
			else if (pose === "hug") [sx, sz, ex] = [
				-1.25,
				out * -.35,
				-.9 + Math.sin(t * 1.3 + i) * .05
			];
			else if (pose === "beg" && out > 0) [sx, sz, ex] = [
				-1.05 + Math.sin(t * 2) * .05,
				.1,
				-.35
			];
			else if (pose === "rant") {
				const g = Math.sin(t * 4.5 + i * 2.1);
				[sx, sz, ex] = [
					-.7 - g * .6,
					out * (.3 + Math.max(0, g) * .6),
					-.8 + g * .3
				];
			} else if (pose === "talk" && tk) {
				const right = out > 0;
				const w = m.talk;
				const beatG = Math.sin(t * 3.1 + i * 1.9);
				const rest = m.stance === "folded" ? [
					-.62,
					out * -.38,
					-1.85
				] : m.stance === "behind" ? [
					.42,
					out * .1,
					-.75
				] : [
					.02,
					out * .12,
					-.2
				];
				const g = tk.move === "explain" ? [
					-.75 - beatG * .2 * w,
					out * (.32 + Math.max(0, beatG) * .2 * w),
					-1 - beatG * .2,
					-out * .25
				] : tk.move === "point" ? right ? [
					-1.45 + Math.sin(t * 6) * .06 * w,
					.18,
					-.25,
					0
				] : [
					rest[0],
					rest[1],
					rest[2],
					0
				] : tk.move === "count" ? right ? [
					-.85,
					-.2,
					-1.35 + Math.max(0, Math.sin(t * 5)) * .25,
					0
				] : [
					-.95,
					.12,
					-1.25,
					0
				] : tk.move === "shrug" ? [
					-.45,
					out * .6,
					-1.25,
					out * .5
				] : tk.move === "chop" ? right ? [
					-.95 - Math.max(0, Math.sin(t * 5.5)) * .45 * w,
					.2,
					-.95,
					0
				] : [
					rest[0],
					rest[1],
					rest[2],
					0
				] : tk.move === "laugh" ? [
					-.55 + Math.sin(t * 11) * .05,
					out * .18,
					-1.55,
					0
				] : [
					rest[0],
					rest[1],
					rest[2],
					0
				];
				[sx, sz, ex, ez] = [
					rest[0] + (g[0] - rest[0]) * tk.e,
					rest[1] + (g[1] - rest[1]) * tk.e,
					rest[2] + (g[2] - rest[2]) * tk.e,
					g[3] * tk.e
				];
				if (tk.move === "shrug") sy = out * .3 * tk.e;
			} else if (pose === "dribble" && out > 0) [sx, sz, ex] = [
				-.55 + Math.sin(t * 14) * .3,
				.32,
				-.5 + Math.sin(t * 14) * .25
			];
			else if (pose === "shoot") [sx, sz, ex] = [
				-2.85,
				out * .12,
				-.35
			];
			else if (pose === "keeper") [sx, sz, ex] = [
				-.5,
				out * .75,
				-.4
			];
			else if (pose === "kick") [sx, sz, ex] = [
				out * .35,
				out * .7,
				-.3
			];
			else if (pose === "hero" && out > 0) [sx, sz, ex, ez] = [
				.15,
				.6,
				-.35,
				-1.75
			];
			else if (run) [sx, sz, ex] = [
				armSwing * 1.1,
				out * .1,
				(-1.5 + Math.cos(armSwing) * .15 - Math.max(0, -armSwing) * .3) * elbowK
			];
			else if (wf === "phone" && out > 0) [sx, sz, ex] = [
				-.9 + armSwing * .08,
				.1,
				-1.5
			];
			else if (walk) [sx, sz, ex] = [
				armSwing * .8,
				out * .07,
				(-.22 - Math.max(0, -armSwing) * .55) * elbowK
			];
			else {
				[sx, sz, ex] = m.stance === "behind" ? [
					.42,
					out * .1,
					-.75
				] : m.stance === "pockets" ? [
					.12,
					out * .2,
					-.35
				] : m.stance === "folded" ? [
					-.62,
					out * -.38,
					-1.85
				] : [
					Math.sin(t * 1.2 + i) * .03,
					out * (.1 + Math.max(0, out * shift) * .03),
					-.14
				];
				if (m.stance === "pockets") ez = -out * .35;
				if (fid) {
					const right = out > 0;
					const gest = fid.kind === "scratch" && right ? [
						-2.5,
						.75,
						-1.75 + Math.sin(t * 15) * .18,
						0
					] : fid.kind === "watch" && !right ? [
						-1.05,
						-.3,
						-1.55,
						0
					] : fid.kind === "watch" ? [
						-.45,
						-.12,
						-.85,
						0
					] : fid.kind === "cross" ? [
						-.75,
						out * -.42,
						-1.95,
						0
					] : fid.kind === "hips" ? [
						.12,
						out * .75,
						-.2,
						-out * 1.55
					] : fid.kind === "wipe" && right ? [
						-2.35,
						.35 + Math.sin(t * 5) * .25,
						-2.05,
						0
					] : fid.kind === "stretch" ? [
						-.15,
						out * (2.75 + Math.sin(t * 2) * .05),
						-.25,
						0
					] : fid.kind === "phone" && right ? [
						-.95,
						.12,
						-1.45,
						0
					] : fid.kind === "phone" ? [
						-.75,
						-.1,
						-1.3,
						0
					] : fid.kind === "behind" ? [
						.42,
						out * .1,
						-.75,
						0
					] : fid.kind === "belt" ? [
						.05,
						out * .32,
						-.75 - Math.sin(t * 6) * .1,
						-out * .6
					] : fid.kind === "chin" && right ? [
						-1.25,
						.05,
						-2.25,
						0
					] : fid.kind === "chin" ? [
						-.7,
						-.35,
						-1.7,
						0
					] : fid.kind === "neck" && right ? [
						-2.2,
						.55,
						-2,
						0
					] : null;
					if (gest) {
						[sx, sz, ex] = [
							sx + (gest[0] - sx) * fid.e,
							sz + (gest[1] - sz) * fid.e,
							ex + (gest[2] - ex) * fid.e
						];
						ez += (gest[3] - ez) * fid.e;
					}
				}
			}
			to(sh.rotation, "x", sx);
			to(sh.rotation, "y", sy);
			to(sh.rotation, "z", sz);
			to(el.rotation, "x", ex);
			to(el.rotation, "z", ez);
		}
		const body = sportBody(pose, t, since) ?? fightBody(pose, t, since) ?? emoteBody(pose, t, since);
		const r = root.current;
		to(r.position, "y", body?.y !== void 0 ? body.y : pose === "pray" ? -.4 : seated ? -.41 : pose === "keeper" ? -.1 : run ? .02 + Math.max(0, Math.sin(ph * 2 - .9)) * .08 : walk ? -Math.cos(ph * 2) * (.012 + stride * .03) * m.bounce - .01 : pose === "busy" ? Math.abs(Math.sin(t * 6)) * .02 : pose === "dance" || pose === "throw" ? -.05 - bounce * .05 : pose === "cheer" ? Math.max(0, jump) * .22 - Math.max(0, -jump) * .07 : tk?.move === "laugh" ? -tk.e * (.02 + Math.abs(Math.sin(t * 11)) * .015) : Math.sin(t * 1.6) * .003 - Math.abs(shift) * .006);
		to(r.position, "z", body?.z ?? 0);
		to(r.position, "x", body?.x !== void 0 ? body.x : walk ? Math.sin(ph) * (run ? .012 : .025 * m.sway) : seated ? 0 : pose === "dance" ? Math.sin(beat / 2) * .09 : shift * .018 * m.sway);
		if (chest.current) {
			const b = Math.sin(t * (pose === "run" ? 4.5 : 1.7));
			chest.current.scale.set(1 + b * .006, 1, 1 + b * (pose === "run" ? .025 : .014));
			to(chest.current.rotation, "y", walk ? -s * stride * .22 : 0);
		}
		to(r.rotation, "x", body?.rx !== void 0 ? body.rx : pose === "leap" ? .3 : pose === "hang" ? .05 : run ? .2 : walk ? .04 + m.lean : pose === "talk" ? tk?.move === "laugh" ? .1 * tk.e : tk?.move === "listen" ? -.02 : .03 * (tk?.e ?? 0) : pose === "dance" ? .06 + bounce * .04 : pose === "throw" ? .05 : 0);
		to(r.rotation, "z", body?.rz !== void 0 ? body.rz : pose === "hang" ? .28 + Math.sin(t * 3.1 + seed) * .03 : walk ? -Math.sin(ph) * .03 * stride * m.sway : seated ? 0 : pose === "dance" ? -Math.sin(beat / 2) * .05 : -shift * .02);
		to(r.rotation, "y", body?.ry !== void 0 ? body.ry : pose === "wash" ? Math.sin(t * .7) * .5 : pose === "dance" ? Math.sin(beat / 2) * .28 + Math.sin(t * .4 + seed) * .4 : pose === "throw" ? Math.sin(beat / 4) * .1 : pose === "rant" ? Math.sin(t * .9) * .5 : pose === "hug" ? Math.sin(t * .8) * .06 : walk ? s * stride * .12 : fid?.kind === "look" ? fid.e * .35 * (seed % 2 < 1 ? 1 : -1) : 0);
		const g = glance.current;
		if (t > g.next) {
			const n = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
			const rnd = n - Math.floor(n);
			g.y = rnd < .5 ? 0 : (rnd - .75) * 1.1;
			g.x = rnd * 7 % 1 < .3 ? .08 : 0;
			g.next = t + 1.5 + rnd * 3.5;
		}
		const hd = head.current;
		const look = fid && (fid.kind === "watch" || fid.kind === "phone") ? fid.e : wf === "phone" ? 1 : 0;
		const back = seed % 2 < 1 ? 1 : -1;
		to(hd.rotation, "y", fid?.kind === "watch" ? -.35 * fid.e : fid?.kind === "look" ? back * .9 * fid.e : pose === "sleep" || pose === "pray" ? 0 : wf === "aside" ? -s * stride * .1 + Math.sin(t * .6 + seed) * .6 : walk ? -s * stride * .1 : pose === "rant" ? Math.sin(t * 2.3) * .45 : pose === "talk" ? Math.sin(t * .9) * .12 + (tk?.move === "point" ? .1 : 0) : fight ? 0 : g.y);
		to(hd.rotation, "z", fid?.kind === "scratch" ? -.14 * fid.e : fid?.kind === "neck" ? Math.sin(t * 2.4) * .3 * fid.e : fid?.kind === "chin" ? .1 * fid.e : tk?.move === "listen" ? .1 * tk.e * back : tk?.move === "shrug" ? .12 * tk.e : pose === "phone" || pose === "call" ? .12 : pose === "sleep" ? .25 : pose === "wave" ? .08 : pose === "talk" ? Math.sin(t * 1.3) * .05 : 0);
		to(hd.rotation, "x", body?.head !== void 0 ? body.head : isJob(pose) ? jobHead(pose, t) : pose === "sleep" ? .35 : pose === "pray" || pose === "cook" ? .3 : pose === "wash" ? -.25 : pose === "busy" || pose === "write" ? .25 : pose === "eat" || pose === "snack" ? .1 : pose === "drink" ? -.15 : pose === "hug" ? .15 : pose === "beg" ? .12 : pose === "dance" ? bounce * .12 - .05 : pose === "cheer" ? -.2 : pose === "talk" && tk ? tk.move === "nod" ? Math.max(0, Math.sin(t * 5)) * .18 * tk.e : tk.move === "laugh" ? -.2 * tk.e + Math.sin(t * 11) * .04 * tk.e : .02 : walk ? (run ? -.12 : -.02) + Math.sin(ph * 2) * .03 * headBob + look * .4 : g.x + Math.sin(t * .7) * .02 + look * .42 - (fid?.kind === "stretch" ? fid.e * .3 : 0));
	});
}
typeof navigator === "undefined" || navigator.hardwareConcurrency;
//#endregion
//#region entry.ts
/** One "component instance": call step each frame with the pose; it re-runs the hook and then its useFrame callback. */
function makePoser(rig, seed = 0) {
	const inst = {
		refs: [],
		i: 0
	};
	return (pose, dt, opts = {}) => {
		withInstance(inst, () => usePoseRig(rig, pose, seed, opts.speed, opts.style, opts.take ?? 0, opts.clock));
		for (const cb of takeFrames()) cb(null, dt);
	};
}
//#endregion
export { EMOTE_POSES, FIGHT_POSES, JOB_POSES, SEATED, freezeWorldTime, makePoser };
