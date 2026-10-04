import fs from 'fs';
import path from 'path';

type EnergySlab = { units: number | null; ratePaisaPerKwh: number };
type FixedChargeBand = { upToKw: number | null; amountPerMonth: number };

export type GujaratTariffProfile = {
    label: string;
    fixedChargesByLoadKw: FixedChargeBand[];
    bplFixedChargePerMonth: number;
    energySlabs: EnergySlab[];
    bplFirstSlab: { units: number; ratePaisaPerKwh: number };
};

export type GujaratTariffTable = {
    scheduleName: string;
    effectiveFrom: string;
    sourceUrl: string;
    discoms: string[];
    tariffs: Record<'RGP' | 'RGP_RURAL', GujaratTariffProfile>;
    utilityCharges: {
        fppasPerKwh: number | null;
        electricityDutyPercentByProfile: Record<string, number | null>;
        electricityDutyBasis: 'ENERGY_CHARGES' | 'ENERGY_AND_FPPAS' | null;
    };
};

export type MonthlyEnergySlice = {
    units: number;
    periodFraction: number;
};

export type ChargeBreakdownItem = { label: string; amount: number };

const tariffPath = path.resolve(process.cwd(), 'config', 'gujarat-discom-tariffs.json');

export function getGujaratTariffTable(): GujaratTariffTable {
    return JSON.parse(fs.readFileSync(tariffPath, 'utf8')) as GujaratTariffTable;
}

export function getMissingUtilityChargeSettings(table: GujaratTariffTable): string[] {
    const missing: string[] = [];
    if (!Number.isFinite(table.utilityCharges.fppasPerKwh)) missing.push('FPPAS rate per kWh');
    if (!table.utilityCharges.electricityDutyBasis) missing.push('electricity duty calculation basis');
    for (const profile of ['RGP_NON_BPL', 'RGP_BPL', 'RGP_RURAL_NON_BPL', 'RGP_RURAL_BPL']) {
        if (!Number.isFinite(table.utilityCharges.electricityDutyPercentByProfile[profile])) {
            missing.push(`${profile.replaceAll('_', ' ')} electricity duty rate`);
        }
    }
    return missing;
}

function calculateSlabCharge(
    units: number,
    slabs: EnergySlab[],
    periodFraction: number,
    startAtUnits = 0
): number {
    let remainingUnits = Math.max(0, units);
    let slabStart = 0;
    let amount = 0;

    for (const slab of slabs) {
        const slabWidth = slab.units === null ? Number.POSITIVE_INFINITY : slab.units * periodFraction;
        const chargedFrom = Math.max(slabStart, startAtUnits);
        const availableInSlab = Math.max(0, slabWidth - (chargedFrom - slabStart));
        const slabUnits = Math.min(remainingUnits, availableInSlab);
        amount += slabUnits * (slab.ratePaisaPerKwh / 100);
        remainingUnits -= slabUnits;
        slabStart += slabWidth;
        if (remainingUnits <= 0) break;
    }

    return amount;
}

export function calculateGujaratBillCharges(input: {
    table: GujaratTariffTable;
    tariffCategory: 'RGP' | 'RGP_RURAL';
    isBpl: boolean;
    connectedLoadKw: number;
    monthlySlices: MonthlyEnergySlice[];
}): {
    tariffRate: number;
    energyCharges: number;
    fixedCharges: number;
    fppasCharges: number;
    electricityDuty: number;
    utilityCharges: number;
    totalPayable: number;
    breakdown: ChargeBreakdownItem[];
} {
    const { table, tariffCategory, isBpl, connectedLoadKw, monthlySlices } = input;
    const tariff = table.tariffs[tariffCategory];
    let energyCharges = 0;
    let fixedCharges = 0;
    let totalUnits = 0;

    for (const slice of monthlySlices) {
        const units = Math.max(0, slice.units);
        totalUnits += units;
        if (isBpl) {
            const concessionUnits = Math.min(units, tariff.bplFirstSlab.units * slice.periodFraction);
            energyCharges += concessionUnits * (tariff.bplFirstSlab.ratePaisaPerKwh / 100);
            energyCharges += calculateSlabCharge(
                units - concessionUnits,
                tariff.energySlabs,
                slice.periodFraction,
                tariff.bplFirstSlab.units * slice.periodFraction
            );
            fixedCharges += tariff.bplFixedChargePerMonth * slice.periodFraction;
        } else {
            energyCharges += calculateSlabCharge(units, tariff.energySlabs, slice.periodFraction);
            const fixedBand = tariff.fixedChargesByLoadKw.find(
                ({ upToKw }) => upToKw === null || connectedLoadKw <= upToKw
            );
            if (!fixedBand) throw new Error('No fixed charge band matches the connected load');
            fixedCharges += fixedBand.amountPerMonth * slice.periodFraction;
        }
    }

    const fppasCharges = totalUnits * (table.utilityCharges.fppasPerKwh as number);
    const dutyProfile = `${tariffCategory}_${isBpl ? 'BPL' : 'NON_BPL'}`;
    const dutyRate = table.utilityCharges.electricityDutyPercentByProfile[dutyProfile] as number;
    const dutyBase = table.utilityCharges.electricityDutyBasis === 'ENERGY_AND_FPPAS'
        ? energyCharges + fppasCharges
        : energyCharges;
    const electricityDuty = dutyBase * (dutyRate / 100);
    const roundedEnergyCharges = Number(energyCharges.toFixed(2));
    const roundedFixedCharges = Number(fixedCharges.toFixed(2));
    const roundedFppas = Number(fppasCharges.toFixed(2));
    const roundedDuty = Number(electricityDuty.toFixed(2));
    const utilityCharges = Number((roundedFppas + roundedDuty).toFixed(2));
    const totalPayable = Number((roundedEnergyCharges + roundedFixedCharges + utilityCharges).toFixed(2));

    return {
        tariffRate: totalUnits > 0 ? Number((roundedEnergyCharges / totalUnits).toFixed(4)) : 0,
        energyCharges: roundedEnergyCharges,
        fixedCharges: roundedFixedCharges,
        fppasCharges: roundedFppas,
        electricityDuty: roundedDuty,
        utilityCharges,
        totalPayable,
        breakdown: [
            { label: 'Energy charges', amount: roundedEnergyCharges },
            { label: 'Fixed charges', amount: roundedFixedCharges },
            { label: 'FPPAS', amount: roundedFppas },
            { label: 'Electricity duty', amount: roundedDuty },
        ],
    };
}