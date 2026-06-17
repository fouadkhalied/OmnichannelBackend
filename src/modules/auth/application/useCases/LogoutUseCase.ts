import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";

export function logoutUseCase(jti: string): void {
    JtiStore.delete(jti);
}
