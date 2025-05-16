import { Prisma } from '@prisma/client';

// Vessel interfaces
export type VesselWhere = Prisma.VesselWhereInput;
export type VesselOrderBy = Prisma.VesselOrderByWithRelationInput;
export type VesselInclude = Prisma.VesselInclude;
export type VesselSelect = Prisma.VesselSelect;

// Location interfaces
export type LocationWhere = Prisma.LocationWhereInput;
export type LocationOrderBy = Prisma.LocationOrderByWithRelationInput;
export type LocationInclude = Prisma.LocationInclude;
export type LocationSelect = Prisma.LocationSelect;

// SubLocation interfaces
export type SubLocationWhere = Prisma.SubLocationWhereInput;
export type SubLocationOrderBy = Prisma.SubLocationOrderByWithRelationInput;
export type SubLocationInclude = Prisma.SubLocationInclude;
export type SubLocationSelect = Prisma.SubLocationSelect;

// Equipment interfaces
export type EquipmentWhere = Prisma.EquipmentWhereInput;
export type EquipmentOrderBy = Prisma.EquipmentOrderByWithRelationInput;
export type EquipmentInclude = Prisma.EquipmentInclude;
export type EquipmentSelect = Prisma.EquipmentSelect;

// Objects interfaces
export type ObjectsWhere = Prisma.ObjectsWhereInput;
export type ObjectsOrderBy = Prisma.ObjectsOrderByWithRelationInput;
export type ObjectsInclude = Prisma.ObjectsInclude;
export type ObjectsSelect = Prisma.ObjectsSelect;

// Compartment interfaces
export type CompartmentWhere = Prisma.CompartmentWhereInput;
export type CompartmentOrderBy = Prisma.CompartmentOrderByWithRelationInput;
export type CompartmentInclude = Prisma.CompartmentInclude;
export type CompartmentSelect = Prisma.CompartmentSelect;

// DocumentType interfaces
export type DocumentTypeWhere = Prisma.DocumentTypeWhereInput;
export type DocumentTypeOrderBy = Prisma.DocumentTypeOrderByWithRelationInput;
export type DocumentTypeInclude = Prisma.DocumentTypeInclude;
export type DocumentTypeSelect = Prisma.DocumentTypeSelect;

// Inventory interfaces
export type InventoryWhere = Prisma.InventoryWhereInput;
export type InventoryOrderBy = Prisma.InventoryOrderByWithRelationInput;
export type InventoryInclude = Prisma.InventoryInclude;
export type InventorySelect = Prisma.InventorySelect;

// User interfaces
export type UserWhere = Prisma.UserWhereInput;
export type UserOrderBy = Prisma.UserOrderByWithRelationInput;
export type UserInclude = Prisma.UserInclude;
export type UserSelect = Prisma.UserSelect;

// Pin interfaces
export type PinWhere = Prisma.PinsWhereInput;
export type PinOrderBy = Prisma.PinsOrderByWithRelationInput;
export type PinInclude = Prisma.PinsInclude;
export type PinSelect = Prisma.PinsSelect;

// Location Diagram interfaces
export type LocationDiagramWhere = Prisma.LocationDiagramWhereInput;
export type LocationDiagramOrderBy = Prisma.LocationDiagramOrderByWithRelationInput;
export type LocationDiagramInclude = Prisma.LocationDiagramInclude;
export type LocationDiagramSelect = Prisma.LocationDiagramSelect;

// Generic types for backward compatibility
export type where = 
  | VesselWhere 
  | LocationWhere 
  | SubLocationWhere 
  | EquipmentWhere 
  | ObjectsWhere
  | CompartmentWhere
  | DocumentTypeWhere
  | InventoryWhere
  | UserWhere
  | PinWhere
  | LocationDiagramWhere;

export type orderBy = 
  | VesselOrderBy 
  | LocationOrderBy 
  | SubLocationOrderBy 
  | EquipmentOrderBy 
  | ObjectsOrderBy
  | CompartmentOrderBy
  | DocumentTypeOrderBy
  | InventoryOrderBy
  | UserOrderBy
  | PinOrderBy
  | LocationDiagramOrderBy;

export type include = 
  | VesselInclude 
  | LocationInclude 
  | SubLocationInclude 
  | EquipmentInclude 
  | ObjectsInclude
  | CompartmentInclude
  | DocumentTypeInclude
  | InventoryInclude
  | UserInclude
  | PinInclude
  | LocationDiagramInclude;

export type select = 
  | VesselSelect 
  | LocationSelect 
  | SubLocationSelect 
  | EquipmentSelect 
  | ObjectsSelect
  | CompartmentSelect
  | DocumentTypeSelect
  | InventorySelect
  | UserSelect
  | PinSelect
  | LocationDiagramSelect;

export type findManyArgs = {
  skip?: number;
  take?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
};
