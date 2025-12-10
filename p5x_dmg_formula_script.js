// python -m http.server

// I should make a database with all the character skills at max
// should be something like
// char  stats (base)   weapon (base) persona skills (including all buffs/debuffs)  mindscape (max)     cards (set bonus only)
// another app would be rotation simulation
// or just rotation, spit out result

// 1. rotation simulation - 6T
// List of 5 characters - input inportant stats: Speed (for turn order), atk, atk mul, crit, crit mul, card set
// Pick a boss for defense stats
// Pick Wonder knife... (should be able to simulation with his knife at later version???)
// Other characters should have fixed rotation. The only one changing would just be Wonder and Navi and Chord???
//
// Loop would be Rotation X, one change skill A->B->C
// Rotation X1, 2nd change skill A->B->C

// 2nd: Card compare: which card and which set is better

// 3rd: give me a list of team members and their rev card set and their weapons / awareness, and I'll calculate and tell
// you what buffs/debuffs you should use on Wonder.
// May have to tie persona + overwrite persona level to the buffs/debuffs
// Wonder can only have 3 buffs, so I can list all the available buffs out, and do simple calculation based on that
// probably should also list dps stats in battle: attack, dmg mul, crit rate, crit mult, pierce rate
// maybe that is not as important...? buffs are based on user stats, so just wonder stats..., but the dmg will be based on
// the dps stats... may need to check more atk vs. more defense down...
// I think this is the calculation I need to be honest for the best dps

// 4th: Is awareness worth it? Which awareness is better for my BIS team?...

// 5th: Should I have a stat rec??? For example, if all their buffs not adding up to 100% crit, probably not worth doing crit mull??? Nah... impossible


const ENEMY_DEFENSE_DEFAULT = 363.2;  // doesn't have it - use Dominion value instead

const FINAL_DMG_BONUS = 1;  // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 
const OTHER_DMG_BONUS = 1; // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 

const CHAR_STAT_FILE_NAME = "P5X database - stat.csv";
const CARD_FILE_NAME = "P5X database - card.csv";
const SKILL_FILE_NAME = "P5X database - skill.csv";
const WEAPON_FILE_NAME = "P5X database - weapon.csv";
const WONDER_FILE_NAME = "P5X database - wonder.csv";
const FILE_NUM_SKIP_LINE = 2;   // skip the first 2 lines of the csv file

const NAV_BUFF_PERC = 0.20;     // Used for now. Once I do party member, I can remove this and get the correct value

// The base critical rate is 5%, and the base Critical DMG(Mult) is 150%, meaning there’s a 5% chance to deal 1.5x damage.
// If a character has any of this hidden stats in the database, it's a number already added to the base, so don't add the base again.
const BASE_CRIT_RATE = 0.05;
const BASE_CRIT_MULT = 1.5;

// Code Role
const DPS_ROLE = 0;
const SUPPORT_ROLE = 1;
const NAVI_ROLE = 2;
const ALL_ROLE = 3;

// stores data read from the database
let charStatList = [];  
let cardList = [];  
let skillList = [];  
let weaponList = [];  
let wonderList = [];  

// stores info regard the main character to sim/calc for
let iCharInfo = [];

// store a list of all the buff/debuff
let buffList = [];

readCharStatDatabase();
readCardDatabase();
readSkillDatabase();
readWeaponDatabase();
readWonderDatabase();

function runCalculation() {

    getHtmlInfo();

    for (var i = 0; i < charStatList.length; i++) {
        if (charStatList[i].charName == iCharInfo.name) {
            iCharInfo.indexOfCharStatList = 0 + i;
            iCharInfo.hiddenAtk = charStatList[i].hiddenAtk;
            iCharInfo.hiddenCrit = charStatList[i].hiddenCrit;
            iCharInfo.hiddenCritMult = charStatList[i].hiddenCritMult;
        }
    }

    // I need to add hidden stats to these rate... Also should add weapon buffs too
    iCharInfo.atkFlat = iCharInfo.navAtk * NAV_BUFF_PERC + iCharInfo.atkFlat;
    iCharInfo.atkPerc = (iCharInfo.hiddenAtk + iCharInfo.atkPerc) / 100;
    iCharInfo.dmgMult = iCharInfo.dmgMult / 100;
    if (iCharInfo.hiddenCrit > 0) {
        iCharInfo.critRate = (iCharInfo.hiddenCrit + iCharInfo.critRate) / 100;
    }
    else {
        iCharInfo.critRate = BASE_CRIT_RATE + iCharInfo.critRate / 100;
    }

    if (iCharInfo.hiddenCritMult > 0) {
        iCharInfo.critMult = (iCharInfo.hiddenCritMult + iCharInfo.critMult) / 100;
    }
    else {
        iCharInfo.critMult = BASE_CRIT_MULT + iCharInfo.critMult / 100;
    }

    iCharInfo.pierceRate = iCharInfo.pierceRate / 100;
    iCharInfo.baseAtk = 0 + getAtkValueFromAwareness(charStatList[iCharInfo.indexOfCharStatList]) + getWeapAtkValueFromAwareness(charStatList[iCharInfo.indexOfCharStatList]);


    iCharInfo.enemyDefense = ENEMY_DEFENSE_DEFAULT;
    iCharInfo.windswept = 0;    // yes = 0.12

    iCharInfo.atkFinal = calculateAtkFinal(iCharInfo.baseAtk, iCharInfo.atkFlat, iCharInfo.atkPerc);
    iCharInfo.dmgBonusFinal = 1;//calculateDmgBonusFinal(iCharInfo.dmgMult, iCharInfo.cardSet, iCharInfo.skill);

    iCharInfo.critStableDomain = 1;
    if (iCharInfo.includeCrit == "Yes") {
        iCharInfo.critStableDomain = calculateCritStableDomain(iCharInfo.critRate, iCharInfo.critMult);
    }


//    calculateSkillDamage(iCharInfo.atkFinal, iCharInfo.dmgBonusFinal, enemyDefFinal, iCharInfo.critStableDomain, skillPerc, convertEnemyWeaknessTextToValue(iCharInfo.weakness), FINAL_DMG_BONUS, OTHER_DMG_BONUS)


    console.log(iCharInfo);

  //  var result = calcWeaponBasedOnReforge(30, 0, 39);
  //  console.log(result);
//    result = calcWeaponBasedOnReforge(16.3, 21.2, 0);
//    console.log(result);
    //result = calcWeaponBasedOnReforge(34, 44, 0);
//    console.log(result);
}

function getHtmlInfo() {
    iCharInfo.name = document.getElementById('charName').innerHTML;
    iCharInfo.skill = document.getElementById('skillChoice').innerHTML; // Will also filter out support skill so only DPS skill is listed
    iCharInfo.awareness = document.getElementById('awarenessChoice').innerHTML;
    iCharInfo.weapon = document.getElementById('weaponChoice').innerHTML;
    iCharInfo.cardSet = document.getElementById('cardChoice').innerHTML;
    iCharInfo.navAtk = parseFloat(document.getElementById('navAtk').value);

    iCharInfo.atkFlat = 0 + parseFloat(document.getElementById('spaceAtk').value);
    iCharInfo.atkPerc = 0 + parseFloat(document.getElementById('spaceAtkPercent').value);
    iCharInfo.dmgMult = 0 + parseFloat(document.getElementById('spaceDmgMult').value);
    iCharInfo.critRate = 0 + parseFloat(document.getElementById('spaceCritRate').value);
    iCharInfo.critMult = 0 + parseFloat(document.getElementById('spaceCritMult').value);
    iCharInfo.pierceRate = 0 + parseFloat(document.getElementById('spacePierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('sunAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('sunAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('sunDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('sunCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('sunCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('sunPierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('moonAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('moonAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('moonDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('moonCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('moonCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('moonPierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('starAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('starAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('starDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('starCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('starCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('starPierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('skyAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('skyAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('skyDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('skyCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('skyCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('skyPierce').value);

    iCharInfo.weakness = document.getElementById('enemyElemWeakness').innerHTML;
    iCharInfo.includeCrit = document.getElementById('critChoice').innerHTML;
    iCharInfo.bossName = document.getElementById('enemyChoice').innerHTML;

    var ulElement = document.getElementById('defDebuffOutputDiv');
    el = ulElement.firstElementChild;
    while (el) {
        processDefDebuff(el);
        el = el.nextElementSibling;
    }

    ulElement = document.getElementById('atkOutputDiv');
    el = ulElement.firstElementChild;
    while (el) {
        processAtkBuff(el);
        el = el.nextElementSibling;
    }

    // May need to go down to just DefReductionList/DmgMult and Atk/DmgMult list together since some buff does both...
    // Probably have a buff list and a debuff list... that makes the most sense I think...
    // I don't think anything does both buff and debuff...
    // I have to see how I enter info in the database.. I guess

    ulElement = document.getElementById('dmgOutputDiv');
    el = ulElement.firstElementChild;
    while (el) {
        processDmgBuff(el);
        el = el.nextElementSibling;
    }


}

function getAtkValueFromAwareness(charStat) {
    switch (iCharInfo.awareness) {
        case "A0":
            return charStat.a0Atk;
        case "A1":
            return charStat.a1Atk;
        case "A2":
            return charStat.a2Atk;
        case "A3":
            return charStat.a3Atk;
        case "A4":
            return charStat.a4Atk;
        case "A5":
            return charStat.a5Atk;
        case "A6":
            return charStat.a6Atk;
        default:
            console.log("awareness::Code does not match html value.")
            return charStat.a0Atk;
    }
}
function getWeapAtkValueFromAwareness(charStat) {
    switch (iCharInfo.weapon) {
        case "5* Signature":
            return charStat.weap5Atk;
        case "4*":
            return charStat.weap4Atk;
        default:
            console.log("weapon::Code does not match html value.")
            return charStat.weap5Atk;
    }
}

function convertEnemyWeaknessTextToValue(text) {
    switch (text) {
        case "Normal":
            return 1;
        case "Resistance":
            return 0.5;
        case "Weakness":
            return 1.2;
        default:
            console.log("Code does not match html value.")
            return 1;
    }
}

function convertEnemyNameToDefenseValue(text) {
    switch (text) {
        case "Sea of Souls 8 LV89":
            return ENEMY_DEFENSE_DEFAULT; // Doesn't have it
        case "Dominion":
            return 363.2;
        case "Atavaka":
            return 1279.9;
        case "Vishnu":
            return 820.7;
        case "Mini Vishnu":
            return 363.2;
        case "Yatsufusa":
            return 1279.9;
        default:
            console.log("Code does not match html value.")
            return ENEMY_DEFENSE_DEFAULT;
    }
}

function convertEnemyNameToAdditionaDefenseValue(text) {
    switch (text) {
        case "Sea of Souls 8 LV89":
            return 1.632; // 163.2%
        case "Dominion": // fall through
        case "Atavaka":  // fall through
        case "Vishnu":   // fall through
        case "Mini Vishnu":
            return 1.584; // 158.4%
        case "Yatsufusa":
            return 2.059; // 205.9%
        default:
            console.log("Code does not match html value.")
            return 1.584;
    }
}

function fillCharacter(event) {
    let dropdown = document.getElementById("charListDiv");
    var firstChild = dropdown.children[0];  // Save the search Filter

    dropdown.textContent = '';
    dropdown.appendChild(firstChild);   //add back the search field

    readCharStatDatabase();

    // I'm not going to calculate trash DPS of your support/Wonder
    outputCharName(event, dropdown, charStatList, DPS_ROLE);

    const targetElement = dropdown;
    var x = targetElement.parentNode.firstElementChild.nextElementSibling;

    x.className = x.className.replace(" w3-hide", "");

    document.getElementById("userFilterCharlist").value = '';
}
function filterFunctionName() {
    filterFunction("userFilterCharlist", "charListDiv", "a");
}

function filterFunctionCard() {
    filterFunction("userFilterCardlist", "cardListDiv", "a");
}

function filterFunctionDef() {
    filterFunction("userFilterDefDebufflist", "defDebuffListDiv", "a");
}

function filterFunctionAtk() {
    filterFunction("userFilterAtklist", "atkListDiv", "a");
}

function filterFunctionDmg() {
    filterFunction("userFilterDmgList", "dmgListDiv", "a");
}

function outputCharName(event, dropdown, list, role) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].released == 'Y') {
            if (isValidRole(list[i].role, role)) {
                var item = document.createElement("a");
                item.setAttribute('class', 'w3-bar-item w3-button');
                item.innerHTML = list[i].charName;
                item.onclick = function () {
                    replaceHeaderWithName(this);
                };

                dropdown.appendChild(item);
            }
        }
    }
}

function isValidRole(role, roleName) {
    switch(roleName){
        case DPS_ROLE:
            if (role == "Assassin" || role == "Sweeper") {
                return true;
            }
            break;
        case SUPPORT_ROLE:
            if (role == "Strategist" || role == "Medic" || role == "Defense" || role == "Saboteur") {
                return true;
            }
            break;
        case NAVI_ROLE:
            if (role == "Elucidator") {
                return true;
            }
            break;
        case ALL_ROLE:
            return true;
            break;
        default:            
            break;
    }

    return false;
}

// --------------- End of HTML Interface -----------------------

// ------------------ Database related -------------------------
function readCharStatDatabase() {
    if (charStatList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + CHAR_STAT_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.charName = row[i][j++];
            data.released = row[i][j++];
            data.role = row[i][j++];
            data.a0Hp = parseFloat(row[i][j++]);
            data.a0Atk = parseFloat(row[i][j++]);
            data.a0Def = parseFloat(row[i][j++]);
            data.speed = parseFloat(row[i][j++]);
            data.a1Atk = parseFloat(row[i][j++]);
            data.a2Atk = parseFloat(row[i][j++]);
            data.a3Atk = parseFloat(row[i][j++]);
            data.a4Atk = parseFloat(row[i][j++]);
            data.a5Atk = parseFloat(row[i][j++]);
            data.a6Atk = parseFloat(row[i][j++]);
            data.hiddenAtk = parseFloat(row[i][j++]);
            data.hiddenDef = parseFloat(row[i][j++]);
            data.hiddenHp = parseFloat(row[i][j++]);
            data.hiddenCrit = parseFloat(row[i][j++]);
            data.hiddenSpeed = parseFloat(row[i][j++]);
            data.hiddenCritMult = parseFloat(row[i][j++]);
            data.hiddenHealing = parseFloat(row[i][j++]);
            data.hiddenAilment = parseFloat(row[i][j++]);
            data.hiddenSpRecovery = parseFloat(row[i][j++]);
            data.weap4Hp = parseFloat(row[i][j++]);
            data.weap4Atk = parseFloat(row[i][j++]);
            data.weap4Def = parseFloat(row[i][j++]);
            data.weap5Hp = parseFloat(row[i][j++]);
            data.weap5Atk = parseFloat(row[i][j++]);
            data.weap5Def = parseFloat(row[i][j++]);

            charStatList.push(data);
        }
    }

//    console.log(charStatList);
}
function readWeaponDatabase() {

    let weaponList = [];

    if (weaponList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + WEAPON_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.name = row[i][j++];
            data.charName = row[i][j++];

            data.e1r0 = parseFloat(row[i][j++]); // This will be used to determine if it's a 4* or 5* weapon
            data.e1r2 = parseFloat(row[i][j++]);
            data.e1condition = row[i][j++];
            data.e1dbuff = row[i][j++];

            data.e2r0 = parseFloat(row[i][j++]);
            data.e2r1 = parseFloat(row[i][j++]);
            data.e2condition = row[i][j++];
            data.e2dbuff = row[i][j++];

            data.e3r0 = parseFloat(row[i][j++]);
            data.e3r1 = parseFloat(row[i][j++]);
            data.e3condition = row[i][j++];
            data.e3dbuff = row[i][j++];

            data.e3ar0 = parseFloat(row[i][j++]);
            data.e3ar1 = parseFloat(row[i][j++]);
            data.e3acondition = row[i][j++];
            data.e3adbuff = row[i][j++];

            weaponList.push(data);
        }
    }

//    console.log(weaponList);

}


function readCardDatabase() {
    let cardList = [];
    if (cardList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + CARD_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.name = row[i][j++];
            data.e1rate = parseFloat(row[i][j++]);
            data.e1dbcondition = row[i][j++];
            data.e1dbuff = row[i][j++];

            data.e2rate = parseFloat(row[i][j++]);
            data.e2dbcondition = row[i][j++];
            data.e2dbuff = row[i][j++];

            data.s2rate = parseFloat(row[i][j++]);
            data.s2dbcondition = row[i][j++];
            data.s2dbuff = row[i][j++];

            data.s4rate = parseFloat(row[i][j++]);
            data.s4dbcondition = row[i][j++];
            data.s4dbuff = row[i][j++];

            cardList.push(data);
        }
    }

    console.log(cardList);
}

function readSkillDatabase() {

    let skillList = [];
    if (skillList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + SKILL_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.charName = row[i][j++];
            data.skillPos = row[i][j++];
            data.awareness = row[i][j++];
            data.name = row[i][j++];
            data.type = row[i][j++];    // support or fire or passive

            data.e1Lvl10 = parseFloat(row[i][j++]);
            data.e1Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e1Lvl13 = parseFloat(row[i][j++]);
            data.e1Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e1numHit = parseFloat(row[i][j++]);
            data.e1dbuff = row[i][j++];
            data.e1condition = row[i][j++];

            data.e2Lvl10 = parseFloat(row[i][j++]);
            data.e2Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e2Lvl13 = parseFloat(row[i][j++]);
            data.e2Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e2numHit = parseFloat(row[i][j++]);
            data.e2dbuff = row[i][j++];
            data.e2condition = row[i][j++];

            data.e3Lvl10 = parseFloat(row[i][j++]);
            data.e3Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e3Lvl13 = parseFloat(row[i][j++]);
            data.e3Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e3numHit = parseFloat(row[i][j++]);
            data.e3dbuff = row[i][j++];
            data.e3condition = row[i][j++];

            data.e4Lvl10 = parseFloat(row[i][j++]);
            data.e4Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e4Lvl13 = parseFloat(row[i][j++]);
            data.e4Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e4numHit = parseFloat(row[i][j++]);
            data.e4dbuff = row[i][j++];
            data.e4condition = row[i][j++];

            data.e5Lvl10 = parseFloat(row[i][j++]);
            data.e5Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e5Lvl13 = parseFloat(row[i][j++]);
            data.e5Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e5numHit = parseFloat(row[i][j++]);
            data.e5dbuff = row[i][j++];
            data.e5condition = row[i][j++];

            data.e6Lvl10 = parseFloat(row[i][j++]);
            data.e6Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e6Lvl13 = parseFloat(row[i][j++]);
            data.e6Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e6numHit = parseFloat(row[i][j++]);
            data.e6dbuff = row[i][j++];
            data.e6condition = row[i][j++];

            skillList.push(data);
        }
    }

//    console.log(skillList);

}

function readWonderDatabase() {
    let wonderList = [];

    if (wonderList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + WONDER_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.name = row[i][j++];
            data.type = row[i][j++];

            data.e1r0 = parseFloat(row[i][j++]);
            data.e1r1 = parseFloat(row[i][j++]);
            data.e1r2 = parseFloat(row[i][j++]);
            data.e1r3 = parseFloat(row[i][j++]);
            data.e1r4 = parseFloat(row[i][j++]);
            data.e1r5 = parseFloat(row[i][j++]);
            data.e1r6 = parseFloat(row[i][j++]);
            data.e1dbuff = row[i][j++];
            data.e1condition = row[i][j++];

            data.e2r0 = parseFloat(row[i][j++]);
            data.e2r1 = parseFloat(row[i][j++]);
            data.e2r2 = parseFloat(row[i][j++]);
            data.e2r3 = parseFloat(row[i][j++]);
            data.e2r4 = parseFloat(row[i][j++]);
            data.e2r5 = parseFloat(row[i][j++]);
            data.e2r6 = parseFloat(row[i][j++]);
            data.e2dbuff = row[i][j++];
            data.e2condition = row[i][j++];

            data.e3r0 = parseFloat(row[i][j++]);
            data.e3r1 = parseFloat(row[i][j++]);
            data.e3r2 = parseFloat(row[i][j++]);
            data.e3r3 = parseFloat(row[i][j++]);
            data.e3r4 = parseFloat(row[i][j++]);
            data.e3r5 = parseFloat(row[i][j++]);
            data.e3r6 = parseFloat(row[i][j++]);
            data.e3dbuff = row[i][j++];
            data.e3condition = row[i][j++];

            data.e4r0 = parseFloat(row[i][j++]);
            data.e4r1 = parseFloat(row[i][j++]);
            data.e4r2 = parseFloat(row[i][j++]);
            data.e4r3 = parseFloat(row[i][j++]);
            data.e4r4 = parseFloat(row[i][j++]);
            data.e4r5 = parseFloat(row[i][j++]);
            data.e4r6 = parseFloat(row[i][j++]);
            data.e4dbuff = row[i][j++];
            data.e4condition = row[i][j++];

            data.e5r0 = parseFloat(row[i][j++]);
            data.e5r1 = parseFloat(row[i][j++]);
            data.e5r2 = parseFloat(row[i][j++]);
            data.e5r3 = parseFloat(row[i][j++]);
            data.e5r4 = parseFloat(row[i][j++]);
            data.e5r5 = parseFloat(row[i][j++]);
            data.e5r6 = parseFloat(row[i][j++]);
            data.e5dbuff = row[i][j++];
            data.e5condition = row[i][j++];

            data.e6r0 = parseFloat(row[i][j++]);
            data.e6r1 = parseFloat(row[i][j++]);
            data.e6r2 = parseFloat(row[i][j++]);
            data.e6r3 = parseFloat(row[i][j++]);
            data.e6r4 = parseFloat(row[i][j++]);
            data.e6r5 = parseFloat(row[i][j++]);
            data.e6r6 = parseFloat(row[i][j++]);
            data.e6dbuff = row[i][j++];
            data.e6condition = row[i][j++];

            wonderList.push(data);
        }
    }

//    console.log(wonderList);
}

