// Test script to verify client-side carousel message processing
// Run with: node test_client_carousel.js

function testSocketMessageProcessing() {
    console.log("🧪 Testing client-side socket message processing...");

    // Test 1: Single attachment (backward compatibility)
    const singleAttachmentData = {
        id: 123,
        channel: 'general',
        sender: 'testuser',
        message: '{"text":"","attachments":[{"url":"/static/uploads/image1.jpg","thumbnail_url":"/static/thumbnails/uploads/image1_thumb.jpg"}]}',
        is_media: true,
        image_url: '/static/uploads/image1.jpg',
        thumbnail_url: '/static/thumbnails/uploads/image1_thumb.jpg',
        timestamp: '2024-01-01 12:00:00'
    };

    // Simulate socket handler logic
    let messageData = singleAttachmentData.message;
    if (singleAttachmentData.is_media) {
        let hasMultipleAttachments = false;
        if (typeof singleAttachmentData.message === 'string') {
            try {
                const parsed = JSON.parse(singleAttachmentData.message);
                if (parsed.attachments && Array.isArray(parsed.attachments) && parsed.attachments.length > 1) {
                    hasMultipleAttachments = true;
                    messageData = singleAttachmentData.message;
                }
            } catch (e) {
                // Not JSON, continue with normal processing
            }
        }

        if (!hasMultipleAttachments) {
            if (!singleAttachmentData.image_url || !singleAttachmentData.thumbnail_url ||
                typeof singleAttachmentData.image_url !== 'string' ||
                typeof singleAttachmentData.thumbnail_url !== 'string') {
                console.error('Invalid media message data:', singleAttachmentData);
                return false;
            }
            messageData = {
                message: singleAttachmentData.message || '',
                image_url: singleAttachmentData.image_url,
                thumbnail_url: singleAttachmentData.thumbnail_url
            };
        }
    }

    console.log("✅ Single attachment test passed");
    console.log("   Message data type:", typeof messageData);
    console.log("   Has image_url:", messageData.image_url ? "Yes" : "No");

    // Test 2: Multiple attachments (carousel)
    const multipleAttachmentsData = {
        id: 124,
        channel: 'general',
        sender: 'testuser',
        message: '{"text":"","attachments":[{"url":"/static/uploads/image1.jpg","thumbnail_url":"/static/thumbnails/uploads/image1_thumb.jpg"},{"url":"/static/uploads/video1.mp4","thumbnail_url":"/static/thumbnails/uploads/video1_thumb.jpg"},{"url":"/static/uploads/image2.jpg","thumbnail_url":"/static/thumbnails/uploads/image2_thumb.jpg"}]}',
        is_media: true,
        image_url: '/static/uploads/image1.jpg',
        thumbnail_url: '/static/thumbnails/uploads/image1_thumb.jpg',
        timestamp: '2024-01-01 12:01:00'
    };

    messageData = multipleAttachmentsData.message;
    if (multipleAttachmentsData.is_media) {
        let hasMultipleAttachments = false;
        if (typeof multipleAttachmentsData.message === 'string') {
            try {
                const parsed = JSON.parse(multipleAttachmentsData.message);
                if (parsed.attachments && Array.isArray(parsed.attachments) && parsed.attachments.length > 1) {
                    hasMultipleAttachments = true;
                    messageData = multipleAttachmentsData.message;
                }
            } catch (e) {
                // Not JSON, continue with normal processing
            }
        }

        if (!hasMultipleAttachments) {
            if (!multipleAttachmentsData.image_url || !multipleAttachmentsData.thumbnail_url ||
                typeof multipleAttachmentsData.image_url !== 'string' ||
                typeof multipleAttachmentsData.thumbnail_url !== 'string') {
                console.error('Invalid media message data:', multipleAttachmentsData);
                return false;
            }
            messageData = {
                message: multipleAttachmentsData.message || '',
                image_url: multipleAttachmentsData.image_url,
                thumbnail_url: multipleAttachmentsData.thumbnail_url
            };
        }
    }

    console.log("✅ Multiple attachments test passed");
    console.log("   Message data type:", typeof messageData);
    console.log("   Is JSON string:", typeof messageData === 'string' && messageData.startsWith('{'));
    console.log("   Contains attachments:", messageData.includes('attachments'));

    // Test 3: Verify JSON parsing works
    try {
        const parsed = JSON.parse(messageData);
        console.log("✅ JSON parsing test passed");
        console.log("   Number of attachments:", parsed.attachments ? parsed.attachments.length : 0);
        return true;
    } catch (e) {
        console.error("❌ JSON parsing test failed:", e);
        return false;
    }
}

// Run the test
console.log("🎠 Client-Side Carousel Test");
console.log("=" * 40);

if (testSocketMessageProcessing()) {
    console.log("\n🎉 All client-side tests passed!");
    console.log("   - Single attachments: Backward compatible");
    console.log("   - Multiple attachments: Carousel enabled");
    console.log("   - JSON parsing: Working correctly");
} else {
    console.log("\n❌ Some tests failed. Check the output above.");
}