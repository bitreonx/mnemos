// Sample fixture for tests
export function authenticate(user: string): boolean {
  return user.length > 0;
}

export class UserService {
  login(email: string) {
    return authenticate(email);
  }
}
