import { IsArray, IsEmail } from "class-validator";

export class CreateCommunityInvitationDto {
  @IsArray()
  @IsEmail({}, { each: true })
  emails!: string[];
}

export class AcceptInvitationResponseDto {
  organizerName!: string;
  organizerEmail!: string;
  inviteeEmail!: string;
}
