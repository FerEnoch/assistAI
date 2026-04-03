import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Workspace, WorkspaceMember } from '@assistai/entities';
import { EmailService } from './email.service';
import type { MagicLinkPayload } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
  ) {}

  /**
   * Dev mode: create user + session without sending magic link email.
   * Only works when DEV_AUTH_BYPASS=true.
   */
  async devLogin(email: string): Promise<{ user: User; workspace: Workspace }> {
    const isDevMode = process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === 'true';
    
    if (!isDevMode) {
      throw new UnauthorizedException('Dev login is only available in development with DEV_AUTH_BYPASS=true');
    }

    this.logger.log(`DEV LOGIN: Creating user ${email} without email verification`);

    // Find or create user
    let user = await this.userRepo.findOne({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = this.userRepo.create({
        email,
        locale: 'es-ES',
        status: 'active',
      });
      user = await this.userRepo.save(user);
      this.logger.log(`DEV: New user created: ${user.id} (${email})`);
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // Find or create default workspace
    let workspace = await this.workspaceRepo.findOne({
      where: { ownerUserId: user.id },
      order: { createdAt: 'ASC' },
    });

    if (!workspace) {
      workspace = this.workspaceRepo.create({
        ownerUserId: user.id,
        name: 'Mi espacio de trabajo',
        primaryLanguage: 'es',
      });
      workspace = await this.workspaceRepo.save(workspace);
      this.logger.log(`DEV: Default workspace created: ${workspace.id} for user ${user.id}`);

      // Create workspace_members record with owner role
      const member = this.memberRepo.create({
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
      });
      await this.memberRepo.save(member);
    }

    if (isNewUser) {
      this.logger.log(`DEV: First login for ${email} — user ${user.id}, workspace ${workspace.id}`);
    }

    return { user, workspace };
  }

  /**
   * Send a magic link email.
   * Signs a 15-min JWT with the user's email and sends it via Resend.
   */
  async sendMagicLink(email: string): Promise<void> {
    const payload: MagicLinkPayload = {
      sub: email,
      purpose: 'magic-link',
    };

    const token = this.jwtService.sign(payload, { expiresIn: '15m' });
    const magicLinkUrl = `${process.env.MAGIC_LINK_URL}?token=${encodeURIComponent(token)}`;

    this.logger.log(`Sending magic link to ${email}`);

    await this.emailService.sendMagicLink({ to: email, magicLinkUrl });
  }

  /**
   * Verify a magic-link token.
   * Creates the user + default workspace + workspace_member if they don't exist (first login).
   * Updates last_login_at.
   * Returns the user and their first workspace.
   */
  async verifyMagicLink(token: string): Promise<{ user: User; workspace: Workspace }> {
    let payload: MagicLinkPayload;

    try {
      payload = this.jwtService.verify<MagicLinkPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired magic link token');
    }

    if (payload.purpose !== 'magic-link') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const email = payload.sub;

    // Find or create user
    let user = await this.userRepo.findOne({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = this.userRepo.create({
        email,
        locale: 'es-ES',
        status: 'active',
      });
      user = await this.userRepo.save(user);
      this.logger.log(`New user created: ${user.id} (${email})`);
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // Find or create default workspace
    let workspace = await this.workspaceRepo.findOne({
      where: { ownerUserId: user.id },
      order: { createdAt: 'ASC' },
    });

    if (!workspace) {
      workspace = this.workspaceRepo.create({
        ownerUserId: user.id,
        name: 'Mi espacio de trabajo',
        primaryLanguage: 'es',
      });
      workspace = await this.workspaceRepo.save(workspace);
      this.logger.log(`Default workspace created: ${workspace.id} for user ${user.id}`);

      // Create workspace_members record with owner role
      const member = this.memberRepo.create({
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
      });
      await this.memberRepo.save(member);
      this.logger.log(`Workspace member (owner) created for user ${user.id} in workspace ${workspace.id}`);
    }

    if (isNewUser) {
      this.logger.log(`First login for ${email} — user ${user.id}, workspace ${workspace.id}`);
    }

    return { user, workspace };
  }

  /**
   * Get user by ID.
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  /**
   * Get workspace by ID.
   */
  async getWorkspaceById(id: string): Promise<Workspace | null> {
    return this.workspaceRepo.findOne({ where: { id } });
  }
}
