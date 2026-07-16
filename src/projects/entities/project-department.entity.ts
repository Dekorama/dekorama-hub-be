import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../project.entity';

export enum DepartmentType {
  STRUCTURE = 'structure',
  ELECTRICITY = 'electricity',
  PLUMBING = 'plumbing',
  FINISHES = 'finishes',
  HVAC = 'hvac',
  OTHER = 'other',
}

export enum DepartmentStatus {
  PLANNED = 'planned',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

@Entity('project_departments')
export class ProjectDepartment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.departments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({
    type: 'enum',
    enum: DepartmentType,
  })
  department!: DepartmentType;

  @Column({
    type: 'enum',
    enum: DepartmentStatus,
    default: DepartmentStatus.PLANNED,
  })
  status!: DepartmentStatus;

  @Column({ type: 'int', default: 0, name: 'progress_percentage' })
  progressPercentage!: number;

  @Column({ type: 'text', nullable: true, name: 'technical_details' })
  technicalDetails!: string | null;

  @Column({ type: 'text', nullable: true, name: 'damage_description' })
  damageDescription!: string | null;

  @Column({ type: 'text', nullable: true, name: 'design_notes' })
  designNotes!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  blueprints!: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  images!: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
