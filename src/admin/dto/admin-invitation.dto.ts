import { IsEmail, IsNotEmpty, IsArray } from "class-validator";

export class InviteAdminDto {
  @IsArray()
  @IsEmail({}, { each: true })
  emails: string[];
}

export class AcceptAdminInvitationResponseDto {
  @IsNotEmpty()
  senderName: string;

  @IsEmail()
  senderEmail: string;

  @IsEmail()
  inviteeEmail: string;
}
