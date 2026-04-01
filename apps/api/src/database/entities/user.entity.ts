import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'display_name' })
  displayName?: string;

  @Column({ type: 'varchar', length: 10, default: 'es-ES' })
  locale!: string;

  @Column({ type: 'enum', enum: ['active', 'suspended', 'deleted'], default: 'active' })
  status!: 'active' | 'suspended' | 'deleted';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  @OneToMany('Workspace', 'owner')
  workspaces?: unknown[];
}
