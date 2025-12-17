/*
 * File: p5x_calculator
 * Description: 
 *  
 * 
 * Author: schau1 / cantiga
 * 
 * Copyright (c) 2025
 * 
*/

const ATK_BATTLE_CONST = 55;    // Thieves Den Bonus
const MIN_VARIANCE = 0.95;
const MAX_VARIANCE = 1.05;
const WINDSWEPT_VALUE = 12; // 12%

// ----------------- Awareness Cal --------------------------------------------//

// R1, R3, R5 increase or R2, R4, R6 increase
function calcWeaponBasedOnReforge(r0, r1, r2, reforgeLevel) {
    var delta = r0;
    var r3 = 0, r4 = 0, r5 = 0, r6 = 0;

    if (r1 != 0) {
        // r1 increase, then r2 = r1, r4 = r3, 
        delta = r1 - r0;
        r2 = r1;
        r3 = r1 + delta;
        r4 = r3;
        r5 = r3 + delta;
        r6 = r5;        
    }
    else if (r2 != 0) {
        delta = r2 - r0;
        r1 = r0;
        r2 = r0 + delta;
        r3 = r2;
        r4 = r2 + delta;
        r5 = r4;
        r6 = r4 + delta;
    }
    else {
        // shouldn't happened. should have data, but since it doesn't, just return r0?
    }

    switch (reforgeLevel) {
        case 0:
            return parseFloat(r0.toFixed(2));
        case 1:
            return parseFloat(r1.toFixed(2));
        case 2:
            return parseFloat(r2.toFixed(2));
        case 3:
            return parseFloat(r3.toFixed(2));
        case 4:
            return parseFloat(r4.toFixed(2));
        case 5:
            return parseFloat(r5.toFixed(2));
        case 6:
            return parseFloat(r6.toFixed(2));
        default:
            return parseFloat(r0.toFixed(2));
    }
}


// × ⓒ 1 - {Enemy Defense Value × [(100% + Additional Defense Coefficient) × (100% - Pierce) - Defense Reduction] × (100% - Windswept 12%)}
// ÷ {Enemy Defense Value ×[(100 % + Additional Defense Coefficient) × (100 % - Pierce) - Defense Reduction] × (100 % - Windswept 12 %) + 1400 }

function calculateEnemyDefenseFinal(enemyDefValue, additionalDefCoef, windSweptBool, pierceRate, defenseReduction) {

    if (windSweptBool) {
        windSwept = WINDSWEPT_VALUE;
    }
    else {
        windSwept = 0;
    }

    var defenseCoefficient = (100 + additionalDefCoef) * (100 - pierceRate) / 100 - defenseReduction;
    if (defenseCoefficient < 0) {
//        console.log("calculateEnemyDefenseFinal::Too many debuffs. defenseCoefficient is " + defenseCoefficient);
        defenseCoefficient = 0;
    }
    var value = (enemyDefValue * defenseCoefficient/100 * (100 - windSwept)/100);

    return (1 - value / (value + 1400));
}

function calculateDmgBonusFinal(dmgMult) {
    return (100 + dmgMult)/100;// + elemDmgInc + DmgTakeInc);
}

// Critical damage multiplies damage by the ‘Critical DMG(Mult)’ amount when critical hits occur.
// The base critical rate is 5 %, and the base Critical DMG(Mult) is 150 %, meaning there’s a 5 % chance to deal 1.5x damage.
// Notably, Dionysus can increase critical rate by 15.7 % through Rebellion, and increase Critical DMG(Mult) by 30 % through its passive.
// In boss sections, while criticals don’t occur due to the Stable Domain, damage is increased based on expected value calculations.
// Critical Rate × (Critical DMG(Mult) - 100 %) :: Max Crit Rate is 100%
// If you increase critical rate by 10%, increasing Critical DMG(Mult) by twice that amount (20%) is most efficient.
function calculateCritStableDomain(critRate, critMult) {
    if (critRate > 100) {
        critRate = 100;
    }

    return (100 + critRate * (critMult - 100)/100)/100;
}

function calculateAtkFinal(base, flat, percent) {
    return (base * (100 + percent)/100 + flat + ATK_BATTLE_CONST);
}

/*
Dmg formula from: https://lufel.net/article/damage-calc/?lang=en

Final Dmg = ⓐ Attack Power Calculation × ⓑ Damage Bonus Calculation × ⓒ Enemy Defense Calculation × ⓓ Critical Calculation × ⓔ Skill Coefficient
× ⓕ Weakness Coefficient × ⓖ Final Damage Bonus × ⓗ Other Coefficients × ⓘ Random Range Coefficient

ⓐ {(Character Attack Value + Weapon Attack Value) × Attack % + Attack Constant}

× ⓑ {100% + Attack Mult. + Elemental Damage Bonus + Increased Damage Taken by Enemy}

× ⓒ 1 - {Enemy Defense Value × [(100% + Additional Defense Coefficient) × (100% - Pierce) - Defense Reduction] × (100% - Windswept 12%)} 
÷ {Enemy Defense Value × [(100% + Additional Defense Coefficient) × (100% - Pierce) - Defense Reduction] × (100% - Windswept 12%) + 1400}

× ⓓ {Critical DMG(Mult) (when Critical occurs) or Stable Domain}

× ⓔ Skill Coefficient 

× ⓕ Weakness Coefficient (Resistance 50% / Normal 100% / Weakness 120%)

× ⓖ Final Damage Bonus 

× ⓗ Other Coefficients 

× ⓘ Random Range Coefficient (0.95~1.05)

ⓖ Final Damage Bonus / ⓗ Other Coefficients
In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. These are calculated separately.

*/
function calculateSkillDamage(atkFinal, dmgMultFinal, enemyDefFinal, critMultFinal, skillPerc, weakness, finalDmgBonus, others) {
    var minSkillDamage;
    var maxSkillDamage;

    var skillDmg = atkFinal * dmgMultFinal * enemyDefFinal * critMultFinal * skillPerc * weakness * finalDmgBonus * others;
    minSkillDamage = Math.round(skillDmg * MIN_VARIANCE);
    maxSkillDamage = Math.round(skillDmg * MAX_VARIANCE);
    var averageSkillDamage = Math.floor((minSkillDamage + maxSkillDamage) / 2);

    return [minSkillDamage, maxSkillDamage, averageSkillDamage];
}
