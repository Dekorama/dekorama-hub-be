import { IsEmail, IsNotEmpty, MinLength } from "class-validator";

export class RegisterAdminDto {
  @IsNotEmpty()
  token: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  name: string;
}
