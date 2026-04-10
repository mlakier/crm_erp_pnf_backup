import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto.js";
import { UpdateUserDto } from "./dto/update-user.dto.js";
import { UsersService } from "./users.service.js";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.listUsers();
  }

  @Get(":userId")
  getUser(@Param("userId") userId: string) {
    return this.usersService.getUser(userId);
  }

  @Post()
  createUser(@Body() input: CreateUserDto) {
    return this.usersService.createUser(input);
  }

  @Patch(":userId")
  updateUser(@Param("userId") userId: string, @Body() input: UpdateUserDto) {
    return this.usersService.updateUser(userId, input);
  }
}
