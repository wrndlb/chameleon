let data = null;
let intervals = [0, -1, 1, 5, 10, 20, 30, 40, 50, 60];

let screenSizes = [
	'default', 'custom', 'profile', 
	'1366x768', '1440x900', '1600x900', 
	'1920x1080', '2560x1440', '2560x1600'
];

let timeZoneValues = [
	"default",
	"ip"
];

timeZoneValues = timeZoneValues.concat(chameleonTimezones.map(tz => tz.zone));

let profileValues = [
	"real",
	"random",
	"randomDesktop",
	"randomMobile",
	"random_win",
	"random_mac",
	"random_linux",
	"random_ios",
	"random_android",
	"custom"
].concat(
	Object
	.entries(uaList)
	.reduce((flat, next) => flat.concat(next[1].map(n => n.value)), [])
);

let whitelistOptions = ["auth", "ip", "ref", "timezone", "websocket", "winName"];

function get(key) {
	return new Promise((resolve) => {
		chrome.storage.local.get(key, (item) => {
			typeof key == "string" ? resolve(item[key]) : resolve(item);
		});
	});
}

// validate settings
function validate(cfg) {
	if (!(
		cfg.headers &&
		cfg.excluded && 
		cfg.settings && 
		cfg.whitelist)) throw Error;

	for (h in cfg.headers) {
		if (['blockEtag', 'disableAuth', 'disableRef', 'enableDNT', 
			 'spoofAccept', 'spoofAcceptLang',  'spoofSourceRef', 'spoofVia',
			 'spoofXFor', 'upgradeInsecureRequests'].includes(h)) {
			if (typeof(cfg.headers[h]) != "boolean") throw Error;
		}

		if (['refererXorigin', 'refererTrimming'].includes(h) && 
		    ( 0 > cfg.headers[h] || cfg.headers[h] > 2)) {
			throw Error;
		}

		if (['spoofViaValue', 'spoofXForValue'].includes(h) && 
		    ( 0 > cfg.headers[h] || cfg.headers[h] > 1)) {
			throw Error;
		}

		if (h == 'spoofAcceptLangValue') {
			var found = languages.findIndex(l => l.value == cfg.headers[h]);

			if ((found == -1 && cfg.headers[h] != "ip") && cfg.headers[h] != "") throw Error;
		}

		if (['viaIP', 'viaIP_profile', 'xforwardedforIP', 'xforwardedforIP_profile'].includes(h) && 
			!/^((?:[0-9]{1,3}\.){3}[0-9]{1,3})?$/.test(cfg.headers[h])) {
			throw Error;
		}
	}

	for (e in cfg.excluded) {
		if (e == "all") {
			if (cfg.excluded[e].length != Object.entries(uaList).length) throw Error;
		} else {
			if (cfg.excluded[e].length != uaList[e].length) throw Error;
		}

		for (i in cfg.excluded[e]) {
			if (typeof(cfg.excluded[e][i]) != "boolean") throw Error;
		}
	}

	for (r in cfg.ipRules) {
		let cidr = new IPCIDR(cfg.ipRules[r].ip);
		if (!cidr.isValid()) throw Error;

		if (languages.findIndex(l => l.display == cfg.ipRules[r].lang) == -1) throw Error;
		if (chameleonTimezones.findIndex(t => t.zone == cfg.ipRules[r].tz) == -1) throw Error;
	}

    for (s in cfg.settings) {
		if (['disableWebSockets', 'enableScriptInjection', 'limitHistory', 'notificationsEnabled', 
				  'protectKeyboardFingerprint', 'protectWinName', 'spoofAudioContext', 'spoofClientRects'].includes(s)) {
			if (typeof(cfg.settings[s]) != "boolean") throw Error;
		}

		if (s == "customScreen" && !/^([0-9]{3,4}x[0-9]{3,4})?$/.test(cfg.settings[s])) throw Error;

		if (s == "screenSize" && !screenSizes.includes(cfg.settings[s])) throw Error;
		
		if (s == "timeZone" && !timeZoneValues.includes(cfg.settings[s])) throw Error;

		if (s == "interval") {
			if (!intervals.includes(cfg.settings[s])) throw Error;

			if (cfg.settings[s] == "-1" && (cfg.minInterval > cfg.maxInterval)) throw Error;
		}

		if (s == "useragent" && !profileValues.includes(cfg.settings[s])) throw Error;
	}

	for (w in cfg.whitelist) {
		if (w == "urlList") {
			for (index in cfg.whitelist[w]) {
				if (!cfg.whitelist[w][index].url || 
					(cfg.whitelist[w][index].re == true && !cfg.whitelist[w][index].pattern)) throw Error;
				
				for (opt in cfg.whitelist[w][index].options) {
					if (!whitelistOptions.includes(opt)) throw Error;
					if (typeof(cfg.whitelist[w][index].options[opt]) != "boolean") throw Error;
				}

				if (!languages.map(l => l.value).includes(cfg.whitelist[w][index].lang) && cfg.whitelist[w][index].lang != "") throw Error;

				if (!["default", "real"].includes(cfg.whitelist[w][index].profile) && profiles.findIndex(p => p.value == cfg.whitelist[w][index].profile) == -1) throw Error;
			}
			continue;
		}

		if (w == "defaultProfile") {
			if (cfg.whitelist.defaultProfile != "none" && profiles.findIndex(cfg.whitelist.defaultProfile) == -1) {
				throw Error;
			}
			continue;
		}

		if (w != "enabled") throw Error;
	}

	$("#import-msg").text("Successfully imported settings. Reloading extension...").css('color', 'olivedrab');
	chrome.runtime.sendMessage({
		action: "import",
		data: cfg
	});
}

document.addEventListener('DOMContentLoaded', async function() {
	data = await get(null);
	
	$("#import").change(async function() {
		var reader = new FileReader();

		// inject an image with the src url
		reader.onload = function(event) {
			fetch(event.target.result)
			.then(res => res.json())
			.then(settings => {
				validate(settings);
			})
			.catch(err => {
				$("#import-msg").text("Could not import settings").css('color', 'red');
			});
		}

		// when the file is read it triggers the onload event above.
		reader.readAsDataURL(this.files[0]);
	});
});