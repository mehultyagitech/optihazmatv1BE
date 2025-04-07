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

  // Create default location
  const location = await prisma.location.upsert({
    where: { name: 'Default Location' },
    update: {},
    create: {
      name: 'Default Location',
    }
  });

  // Create default sublocation
  const subLocation = await prisma.subLocation.upsert({
    where: { name: 'Default Location' },
    update: {},
    create: {
      name: 'Default Location',
    }
  });

  // Create default equipment types
  const equipment = await prisma.equipment.upsert({
    where: { name: 'Default Equipment' },
    update: {},
    create: {
      name: 'Default Equipment',
    }
  });

  const additionalEquipment = [
    'Pumps',
    'Motors',
    'Generators',
    'Compressors',
    'Electrical Panels'
  ];

  for (const name of additionalEquipment) {
    await prisma.equipment.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create default objects
  const defaultObject = await prisma.objects.upsert({
    where: { name: 'Default Object' },
    update: {},
    create: {
      name: 'Default Object',
    }
  });

  const additionalObjects = [
    'Valves',
    'Pipes',
    'Tanks',
    'Filters',
    'Cables'
  ];

  for (const name of additionalObjects) {
    await prisma.objects.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create default compartments
  const compartment = await prisma.compartment.upsert({
    where: { name: 'Default Compartment' },
    update: {},
    create: {
      name: 'Default Compartment',
    }
  });

  const additionalCompartments = [
    'Engine Room',
    'Bridge',
    'Deck',
    'Cargo Hold',
    'Living Quarters'
  ];

  for (const name of additionalCompartments) {
    await prisma.compartment.create({
      data: { name },
    });
  }

  // Create default document types
  const documentType = await prisma.documentType.upsert({
    where: { name: 'Default Document Type' },
    update: {},
    create: {
      name: 'Default Document Type',
    }
  });

  const additionalDocumentTypes = [
    'Technical Manual',
    'Certificate',
    'Inspection Report',
    'Maintenance Log',
    'Safety Protocol'
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
    }
  });

  const additionalInventories = [
    'Spare Parts',
    'Tools',
    'Safety Equipment',
    'Cleaning Supplies',
    'Navigation Equipment'
  ];

  for (const name of additionalInventories) {
    await prisma.inventory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log({
    admin,
    user,
    location,
    subLocation,
    equipment,
    defaultObject,
    compartment,
    documentType,
    inventory
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });