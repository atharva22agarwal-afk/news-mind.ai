const { db } = require('../config/firebase');
const admin = require('firebase-admin');

/**
 * Enhanced Firestore Service with batch operations, proper timestamps, and optimizations
 */
class FirestoreService {
    /**
     * Create a document with proper Firestore timestamps
     */
    async create(collection, data, customId = null) {
        try {
            const docRef = customId 
                ? db.collection(collection).doc(customId) 
                : db.collection(collection).doc();
            
            await docRef.set({
                ...data,
                id: customId || docRef.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error(`Error creating doc in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * Get document by ID
     */
    async getById(collection, id) {
        try {
            const doc = await db.collection(collection).doc(id).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error(`Error getting doc from ${collection}:`, error);
            throw error;
        }
    }

    /**
     * Find one document by field value
     */
    async findOne(collection, field, value) {
        try {
            const snapshot = await db.collection(collection)
                .where(field, '==', value)
                .limit(1)
                .get();
            
            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        } catch (error) {
            console.error(`Error finding doc in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * Update a document
     */
    async update(collection, id, data) {
        try {
            await db.collection(collection).doc(id).update({
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error(`Error updating doc in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * Delete a document
     */
    async delete(collection, id) {
        try {
            await db.collection(collection).doc(id).delete();
            return true;
        } catch (error) {
            console.error(`Error deleting doc from ${collection}:`, error);
            throw error;
        }
    }

    /**
     * BATCH DELETE - Delete multiple documents efficiently
     * Firestore limits: 500 operations per batch, 10 concurrent batches
     */
    async batchDelete(collection, filterField, filterValue, maxDocs = 500) {
        try {
            const batch = db.batch();
            let operationCount = 0;
            
            const snapshot = await db.collection(collection)
                .where(filterField, '==', filterValue)
                .limit(maxDocs)
                .get();
            
            if (snapshot.empty) {
                return { deleted: 0, message: 'No documents to delete' };
            }
            
            snapshot.docs.forEach(doc => {
                if (operationCount < 500) {
                    batch.delete(doc.ref);
                    operationCount++;
                }
            });
            
            await batch.commit();
            
            console.log(`✅ Batch deleted ${operationCount} documents from ${collection}`);
            return { deleted: operationCount, message: `Deleted ${operationCount} documents` };
        } catch (error) {
            console.error(`Error batch deleting from ${collection}:`, error);
            throw error;
        }
    }

    /**
     * BATCH CREATE/UPDATE - Efficient bulk operations
     */
    async batchCreate(collection, documents) {
        try {
            const batch = db.batch();
            const results = [];
            
            documents.forEach((doc, index) => {
                if (index < 500) { // Firestore batch limit
                    const docRef = db.collection(collection).doc();
                    batch.set(docRef, {
                        ...doc,
                        id: docRef.id,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    results.push({ id: docRef.id, ...doc });
                }
            });
            
            await batch.commit();
            console.log(`✅ Batch created ${results.length} documents in ${collection}`);
            return results;
        } catch (error) {
            console.error(`Error batch creating in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * LIST with proper pagination and cursor support
     * Returns documents + next cursor for efficient pagination
     */
    async list(collection, filters = [], limit = 20, orderBy = 'createdAt', direction = 'desc', startAfter = null) {
        try {
            let query = db.collection(collection);
            
            // Apply filters
            filters.forEach(f => {
                query = query.where(f.field, f.operator, f.value);
            });
            
            // Apply ordering
            if (orderBy) {
                query = query.orderBy(orderBy, direction);
            }
            
            // Apply cursor-based pagination (more efficient than offset)
            if (startAfter) {
                query = query.startAfter(startAfter);
            }
            
            query = query.limit(limit);
            const snapshot = await query.get();
            
            const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            return {
                documents: docs,
                hasMore: docs.length === limit,
                nextCursor: lastDoc
            };
        } catch (error) {
            console.error(`Error listing docs from ${collection}:`, error);
            throw error;
        }
    }

    /**
     * COUNT efficiently using aggregated field (Firestore doesn't support count natively)
     * This is a workaround - for accurate counts, maintain a counter document
     */
    async count(collection, filters = []) {
        try {
            let query = db.collection(collection);
            
            filters.forEach(f => {
                query = query.where(f.field, f.operator, f.value);
            });
            
            // Firestore limitation: must read all docs to count
            // For large collections, use a counter document approach
            const snapshot = await query.limit(1000).get(); // Cap at 1000 for cost control
            
            return {
                count: snapshot.size,
                isEstimate: snapshot.size === 1000,
                message: snapshot.size === 1000 ? '1000+ (capped for cost)' : `${snapshot.size}`
            };
        } catch (error) {
            console.error(`Error counting docs in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * INCREMENT a numeric field atomically
     */
    async increment(collection, id, field, amount = 1) {
        try {
            await db.collection(collection).doc(id).update({
                [field]: admin.firestore.FieldValue.increment(amount)
            });
            return true;
        } catch (error) {
            console.error(`Error incrementing ${field} in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * ARRAY UNION - Add to array without duplicates
     */
    async arrayUnion(collection, id, field, ...values) {
        try {
            await db.collection(collection).doc(id).update({
                [field]: admin.firestore.FieldValue.arrayUnion(...values)
            });
            return true;
        } catch (error) {
            console.error(`Error array union in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * ARRAY REMOVE - Remove from array
     */
    async arrayRemove(collection, id, field, ...values) {
        try {
            await db.collection(collection).doc(id).update({
                [field]: admin.firestore.FieldValue.arrayRemove(...values)
            });
            return true;
        } catch (error) {
            console.error(`Error array remove in ${collection}:`, error);
            throw error;
        }
    }

    /**
     * TRANSACTION - Execute multiple operations atomically
     */
    async transaction(updateFunction) {
        try {
            return await db.runTransaction(updateFunction);
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    }

    /**
     * BATCH WRITE - Execute multiple writes atomically
     */
    async batchWrite(operations) {
        try {
            const batch = db.batch();
            
            operations.forEach(op => {
                const ref = db.collection(op.collection).doc(op.id);
                
                if (op.type === 'set') {
                    batch.set(ref, op.data);
                } else if (op.type === 'update') {
                    batch.update(ref, op.data);
                } else if (op.type === 'delete') {
                    batch.delete(ref);
                }
            });
            
            await batch.commit();
            return true;
        } catch (error) {
            console.error('Batch write error:', error);
            throw error;
        }
    }

    /**
     * MAINTAIN COUNTER - Helper for maintaining count documents
     * Use this to avoid expensive count queries
     */
    async maintainCounter(counterDocId, collection, delta = 1) {
        try {
            const counterRef = db.collection('counters').doc(counterDocId);
            
            await db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                
                if (!counterDoc.exists) {
                    transaction.set(counterRef, {
                        collection,
                        count: delta,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    transaction.update(counterRef, {
                        count: admin.firestore.FieldValue.increment(delta),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
            
            return true;
        } catch (error) {
            console.error('Counter maintenance error:', error);
            throw error;
        }
    }

    /**
     * GET WITH COUNTER - Get document and update counter atomically
     */
    async getWithCounter(collection, id, counterDocId) {
        try {
            return await db.runTransaction(async (transaction) => {
                const docRef = db.collection(collection).doc(id);
                const doc = await transaction.get(docRef);
                
                if (!doc.exists) {
                    return null;
                }
                
                // Increment view count atomically
                transaction.update(docRef, {
                    viewCount: admin.firestore.FieldValue.increment(1)
                });
                
                // Update counter
                const counterRef = db.collection('counters').doc(counterDocId);
                transaction.update(counterRef, {
                    totalViews: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                return doc.data();
            });
        } catch (error) {
            console.error('Get with counter error:', error);
            throw error;
        }
    }
}

module.exports = new FirestoreService();
