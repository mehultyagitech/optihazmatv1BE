import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      roles: Role.ADMIN,
    },
  });

  // Create regular user
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Regular User',
      password: userPassword,
      roles: Role.USER,
    },
  });

  const locationNames = [
    'A-Deck',
    'B-Deck',
    'C-Deck',
    'Engine Control Room',
    'Fore Part',
    'Nav Bridge Deck Plan',
  ];

  // Create default locations
  for (const name of locationNames) {
    await prisma.location.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create default sublocation
  const subLocationNames = [
    '3rd Deck Starboard',
    'Battery Room',
    'Chain Locker',
    'Engine room',
    'Fire Station',
    'Galley',
    'Life Boat',
    'Main Air Reservoir',
    "Master's Day Room",
  ];

  for (const name of subLocationNames) {
    await prisma.subLocation.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const equipmentNames = [
    'IT Rack UPS 1 (Next Gen and NET SWAN)',
    'BALLAST COMPUTER UPS BATTERY',
    'CENTRIFUGAL PUMP (x1 piece/1)',
    'FUEL GAS SUPPLY SYSTEM FOR ME-GI ENGINE (x1 piece/1) [MITSUBISHI SHIPBUILDING CO., LTD. : MSB-FGSS-0008]',
    'GEAR PUMP (x1 piece/1)',
    'HYDROPHORE TANK UNIT (x1 piece/1)',
  ];

  // Create default equipment
  for (const name of equipmentNames) {
    await prisma.equipment.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const objectNames = [
    'Battery Electrodes',
    'Electronic components on PCB',
    'Floor Covering',
    'Gauge',
    'Lead solder',
    'Actuator',
  ];

  // Create default objects
  for (const name of objectNames) {
    await prisma.objects.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const compartmentNames = [
    'A DECK',
    'Accommodation Deck houses',
    'Anti-slippery mat',
    'Battery',
    'Bulkhead & deckhead',
    'Deck',
    'Deck floor',
  ];

  for (const name of compartmentNames) {
    await prisma.compartment.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create default document types
  const documentType = await prisma.documentType.upsert({
    where: { name: 'Default Document Type' },
    update: {},
    create: {
      name: 'Default Document Type',
    },
  });

  const additionalDocumentTypes = [
    'Technical Manual',
    'Certificate',
    'Inspection Report',
    'Maintenance Log',
    'Safety Protocol',
  ];

  for (const name of additionalDocumentTypes) {
    await prisma.documentType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create default inventory items
  const inventory = await prisma.inventory.upsert({
    where: { name: 'Default Inventory' },
    update: {},
    create: {
      name: 'Default Inventory',
    },
  });

  const additionalInventories = [
    'Spare Parts',
    'Tools',
    'Safety Equipment',
    'Cleaning Supplies',
    'Navigation Equipment',
  ];

  for (const name of additionalInventories) {
    await prisma.inventory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const HazmatNames = [
    'Asbestos',
    'Polychlorinated biphenyls (PCBs)',
    'Ozone Depleting Substance (ODS)',
    'Anti-fouling systems containing organotin compounds as a biocide',
    'Cybutryne',
    'Perfluorooctane sulfonic acid (PFOS)',
    'Cadmium and cadmium compounds',
    'Hexavalent chromium and hexavalent chromium compounds',
    'Lead and lead compounds',
    'Mercury and mercury compounds',
    'Polybrominated biphenyl (PBBs)',
    'Polybrominated diphenyl ethers (PBDEs)',
    'Polychloronaphthalenes (Cl >=3)',
    'Radioactive substances',
    'Certain shortchain chlorinated paraffins (CSCP)',
    'Brominated flame retardant (HBCDD)',
  ];

  // Create default Hazmat items
  for (const name of HazmatNames) {
    await prisma.hazmat.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
