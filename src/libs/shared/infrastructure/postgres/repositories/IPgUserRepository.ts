import { User, NewUser } from "../schema/users";

export interface IPgUserRepository {
    upsert(input: NewUser): Promise<void>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    delete(id: string): Promise<void>;
}
