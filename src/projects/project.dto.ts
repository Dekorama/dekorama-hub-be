import { ProjectStatus, ProjectType } from "./project.entity";
import { DepartmentStatus, DepartmentType } from "./entities/project-department.entity";
import { ProjectMemberRole } from "./entities/project-member.entity";

export class CreateProjectDto {
  title!: string;
  description!: string;
  isPublic!: boolean;
  projectType!: ProjectType;
  locality?: string;
  departments!: DepartmentType[];
  budget?: number;
  location?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export class UpdateProjectDto {
  title?: string;
  description?: string;
  isPublic?: boolean;
  status?: ProjectStatus;
  budget?: number;
  location?: string;
  locality?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export class AddProjectDepartmentsDto {
  departments!: DepartmentType[];
}

export class EnrichDepartmentDto {
  technicalDetails!: string;
  damageDescription?: string;
  designNotes?: string;
  blueprints?: string[];
  images?: string[];
}

export class UpdateDepartmentProgressDto {
  status?: DepartmentStatus;
  progressPercentage?: number;
}

export class CreateProgressEntryDto {
  title!: string;
  description!: string;
  departmentId?: string;
  progressPercentage?: number;
}

export class CreateProjectNoteDto {
  content!: string;
}

export class AddProjectProductDto {
  productSku!: string;
  quantity!: number;
  notes?: string;
}

export class AssignProjectMemberDto {
  userId!: string;
  role!: ProjectMemberRole;
}

export class InviteProjectMemberDto {
  email!: string;
  role!: ProjectMemberRole;
}
