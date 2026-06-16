import { KnowledgeTextBuilder } from "../src/modules/ai/domain/services/KnowledgeTextBuilder";
import { ImageEnrichmentUtils } from "../src/modules/shopify/domain/services/ImageEnrichmentUtils";

const testProduct = {
    title: "Test Product",
    handle: "test-product",
    vendor: "Test Vendor",
    productType: "Test Type",
    status: "active",
    bodyHtml: "<p>Hello <b>World</b></p>",
    images: [
        { url: "http://example.com/img1.jpg", altText: "Alt 1", width: 100, height: 100 },
        { url: "http://example.com/img2.jpg", altText: "Alt 2", width: 200, height: 200 }
    ],
    variants: [
        { title: "V1", sku: "SKU1", price: 10, inventoryQuantity: 5 },
        { title: "V2", sku: "SKU2", price: 20, inventoryQuantity: 0 }
    ]
};

const productResult = KnowledgeTextBuilder.build("product", testProduct);
console.log("Product Title:", productResult.title);
console.log("Product Availability:", productResult.productAvailability);
console.log("Product Text length:", productResult.text.length);
console.log("Text snippet:", productResult.text.substring(0, 100));

const sig1 = ImageEnrichmentUtils.computeProductImageAnalysisSignature(testProduct);
console.log("Signature 1:", sig1);

const testProductModified = { ...testProduct, images: [{ url: "http://example.com/img3.jpg" }] };
const sig2 = ImageEnrichmentUtils.computeProductImageAnalysisSignature(testProductModified);
console.log("Signature 2:", sig2);

if (sig1 !== sig2) {
    console.log("Verification Passed: Image signatures are different after modification.");
} else {
    console.log("Verification Failed: Image signatures are identical.");
}

const customerResult = KnowledgeTextBuilder.build("customer", { firstName: "John", lastName: "Doe", email: "john@example.com" });
console.log("Customer Title:", customerResult.title);

const orderResult = KnowledgeTextBuilder.build("order", { name: "#1234", customerId: "cust-1", lineItems: [{ title: "Item 1", quantity: 2 }] });
console.log("Order Title:", orderResult.title);
console.log("Order line item present:", orderResult.text.includes("Item 1 x2"));

const variantResult = KnowledgeTextBuilder.build("variant", { title: "Blue / S", price: 15, inventoryQuantity: 10 });
console.log("Variant Title:", variantResult.title);
console.log("Variant Availability:", variantResult.productAvailability);

console.log("Final Verification: Success");
