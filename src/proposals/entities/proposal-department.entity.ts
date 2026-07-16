import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Proposal } from '../proposal.entity';
import { ProjectDepartment } from '../../projects/entities/project-department.entity';

@Entity('proposal_departments')
export class ProposalDepartment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'proposal_id' })
  proposalId!: string;

  @ManyToOne(() => Proposal, (proposal) => proposal.proposalDepartments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proposal_id' })
  proposal!: Proposal;

  @Column({ name: 'project_department_id' })
  projectDepartmentId!: string;

  @ManyToOne(() => ProjectDepartment)
  @JoinColumn({ name: 'project_department_id' })
  projectDepartment!: ProjectDepartment;

  @Column({ type: 'float', name: 'partial_labor_cost' })
  partialLaborCost!: number;

  @Column({ type: 'int', nullable: true, name: 'estimated_days' })
  estimatedDays!: number | null;
}
