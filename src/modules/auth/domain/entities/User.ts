export class User {
    constructor(
        public readonly id: string,
        public readonly email: string,
        public readonly passwordHash: string,
        public readonly displayName: string,
        public readonly role: string,
        public readonly isActivated: boolean,
        public readonly activatedAt?: Date,
        public readonly createdAt?: Date,
        public readonly updatedAt?: Date,
    ) { }
}
