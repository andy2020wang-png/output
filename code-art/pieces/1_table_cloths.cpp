// 程序与艺术 · Tweetable Mathematical Art
// @rank 1
// @votes 207
// @title Table cloths
// @author trichoplax
// @url https://codegolf.stackexchange.com/a/35641
// @license CC BY-SA 4.0
// @read u8
//
// The three function bodies below are the "Colour" version from trichoplax's answer,
// unchanged. Everything outside the three functions belongs to this repository.
#define TWEET_T unsigned char
#include "tweet.h"
unsigned char GR(int,int);
unsigned char BL(int,int);

unsigned char RD(int i,int j){
    float s=3./(j+99);
    float y=(j+sin((i*i+_sq(j-700)*5)/100./DIM)*35)*s;
    return (int((i+DIM)*s+y)%2+int((DIM*2-i)*s+y)%2)*127;
}
unsigned char GR(int i,int j){
    float s=3./(j+99);
    float y=(j+sin((i*i+_sq(j-700)*5)/100./DIM)*35)*s;
    return (int(5*((i+DIM)*s+y))%2+int(5*((DIM*2-i)*s+y))%2)*127;
}
unsigned char BL(int i,int j){
    float s=3./(j+99);
    float y=(j+sin((i*i+_sq(j-700)*5)/100./DIM)*35)*s;
    return (int(29*((i+DIM)*s+y))%2+int(29*((DIM*2-i)*s+y))%2)*127;
}

TWEET_MAIN(RD, GR, BL)
