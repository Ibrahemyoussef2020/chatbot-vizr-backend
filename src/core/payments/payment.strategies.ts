import { PaymentGatewayFactory } from "./payment-gateway.factory.js";
import { StripePaymentGateway } from "./providers/stripe.provider.js";
import { VodafoneCashPaymentGateway } from "./providers/vodafone-cash.provider.js";

PaymentGatewayFactory.registerProvider(new StripePaymentGateway());
PaymentGatewayFactory.registerProvider(new VodafoneCashPaymentGateway());
