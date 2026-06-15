import { UserService } from '../auth/service';

export default function LoginPage() {
  const service = new UserService();
  return service.login('user@example.com');
}
