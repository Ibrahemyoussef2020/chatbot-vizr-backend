import { gatewayUnsupportedError } from "../shared/errors/PaymentError.js";
import type { IPaymentGateway } from "./payment.interface.js";
import type { PaymentProvider, ProviderDescriptor } from "./payment.types.js";

export class PaymentGatewayFactory {
    private static readonly providerRegistry: Map<string, IPaymentGateway> = new Map();

    public static registerProvider(gateway: IPaymentGateway): void {
        this.providerRegistry.set(gateway.provider, gateway);
        console.log(`[PaymentGatewayFactory] Provider registered successfully: "${gateway.provider}"`);
    }

    public static getProvider(provider: string): IPaymentGateway {
        const gateway = this.providerRegistry.get(provider);
        if (!gateway) {
            throw gatewayUnsupportedError(provider, "checkout — the provider is not registered");
        }
        return gateway;
    }

    public static hasProvider(provider: string): boolean {
        return this.providerRegistry.has(provider);
    }

    public static listProviders(): PaymentProvider[] {
        return [...this.providerRegistry.keys()] as PaymentProvider[];
    }

    public static listDescriptors(): ProviderDescriptor[] {
        return [...this.providerRegistry.values()].map((gateway) => gateway.descriptor());
    }
}
